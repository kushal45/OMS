import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';
import { Kafka, KafkaConfig, Producer, RecordMetadata } from 'kafkajs';
import { KafkaAdminClient } from './KafKaAdminClient';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { ConfigService } from '@nestjs/config';

export class KafkaProducer {
  private producer: Producer;
  private kafka: Kafka;
  private context: string = 'KafkaProducer';
  private schemaRegistry: SchemaRegistry;
  private isConnected = false;

  constructor(
    config: KafkaConfig,
    private moduleRef: ModuleRef,
    private readonly logger: LoggerService,
  ) {
    const configService = this.moduleRef.get(ConfigService, { strict: false });
    const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
    this.kafka = new Kafka(config);
    this.producer = this.kafka.producer({ idempotent: true });
    this.schemaRegistry = new SchemaRegistry({
      host: schemaRegistryUrl,
      retry: { retries: 5 },
    });
    // Remove eager connect here
    // this.producer.connect().catch(...)
  }

  async send(
    topic: string,
    messageObj: {
      key: string;
      value: unknown[];
    },
  ): Promise<RecordMetadata[]> {
    this.logger.info(`Sending message to topic: ${topic}`, this.context);
    const kafkaAdminClient = this.moduleRef.get<KafkaAdminClient>(
      'KafkaAdminInstance',
      { strict: false },
    );
    const numPartitions = await kafkaAdminClient.getNumberOfPartitions(topic);
    const listPartitions = await kafkaAdminClient.listPartitions(topic);
    kafkaAdminClient.close();
    this.logger.debug(
      `Number of partitions for topic ${topic}: ${numPartitions}, Partitions: ${JSON.stringify(listPartitions)}`,
      this.context,
    );
    if (numPartitions < 1) {
      throw new Error(`Topic ${topic} does not exist or has no partitions`);
    }
    // Always use partition 0 for robust delivery, or let Kafka assign if you want round-robin
    const assignedPartition = listPartitions[0];
    const schemaId = await this.schemaRegistry.getLatestSchemaId(topic);
    this.logger.debug(`SchemaId returned ${schemaId}`, this.context);
    const schemaFetched = await this.schemaRegistry.getSchema(schemaId);
    console.info(`Schema returned: ${JSON.stringify(schemaFetched)}`);
    const encodedMessages = await Promise.all(
      messageObj.value.map(async (msg) => {
        const validMessage = this.validateMessage(schemaFetched, msg);
        return this.schemaRegistry.encode(schemaId, validMessage);
      })
    );
    try {
      if (!this.isConnected) {
        this.logger.info('KafkaProducer: Attempting to connect to broker...', this.context);
        const connectPromise = this.producer.connect();
        // Monitor for connection timeout (e.g., 10s)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('KafkaProducer: Connection to broker timed out')), 10000)
        );
        await Promise.race([connectPromise, timeoutPromise]);
        this.isConnected = true;
        this.logger.info('KafkaProducer: Successfully connected to broker.', this.context);
      }
      const recordMetaData = await this.producer.send({
        topic,
        acks: -1, // Wait for all in-sync replicas to acknowledge
        messages: encodedMessages.map((encodedMessage, index) => ({
          key: `${messageObj.key}-${index}`,
          value: encodedMessage,
          partition: assignedPartition, // Always valid partition
          headers: { "messageCount": messageObj.value.length.toString() },
        })),
      });
      return recordMetaData;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          message: `Failed to send message to topic: ${topic} after retries`,
          error: error.message,
          stack: error.stack,
        }),
        this.context,
      );
      throw error;
    }
  }

  private validateMessage(schema: any, message: any): any {
    const { fields } = schema;
    //console.log(`fields:`,fields,`message:`,message);
    const validMessage: any = {};

    fields.forEach((field: any) => {
      if (message[field.name] === undefined) {
        throw new Error(`Field ${field.name} is missing in the message`);
      }
      validMessage[field.name] = message[field.name];
    });

    return validMessage;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      this.logger.info('KafkaProducer: Disconnecting from broker...', this.context);
      try {
        const disconnectPromise = this.producer.disconnect();
        // Monitor for disconnect timeout (e.g., 10s)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('KafkaProducer: Disconnect from broker timed out')), 10000)
        );
        await Promise.race([disconnectPromise, timeoutPromise]);
        this.logger.info('KafkaProducer: Successfully disconnected from broker.', this.context);
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            message: 'KafkaProducer: Error during disconnect',
            error: error.message,
            stack: error.stack,
          }),
          this.context,
        );
      }
      this.isConnected = false;
    }
  }
}
