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

  constructor(
    config: KafkaConfig,
    private moduleRef: ModuleRef,
    private readonly logger: LoggerService,
  ) {
    const configService = this.moduleRef.get(ConfigService, { strict: false });
    const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
    this.kafka = new Kafka(config);
    this.producer = this.kafka.producer({
      idempotent: true,
    });
    this.schemaRegistry = new SchemaRegistry({
      host: schemaRegistryUrl,
      retry: { retries: 5 }, // Retries for schema registry operations
    });

    this.producer.on('producer.connect', (data) => {
      console.info(`Kafka Producer connected with data: ${JSON.stringify(data)}`);
      this.logger.info('Kafka Producer connected', this.context);
    });
    this.producer.on('producer.disconnect', () => {
      this.logger.info('Kafka Producer disconnected', this.context);
    });
    this.producer.on('producer.network.request_timeout', (event) => {
      this.logger.error(
        JSON.stringify({
          message: `Kafka Producer: Request Timeout`,
          errorDetails: event.payload, // Log the entire payload for context
        }),
        this.context,
      );
    });
    // Connect the producer when the KafkaProducer instance is created
    this.producer.connect().catch(err => {
      this.logger.error(`Kafka Producer: Failed to connect - ${err.message}`, this.context);
      // Depending on the application, you might want to throw this error
      // or implement a retry mechanism for the initial connection.
    });
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
    await this.producer.disconnect();
  }
}
