import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';
import { Kafka, KafkaConfig, Producer, RecordMetadata } from 'kafkajs';
import { KafkaAdminClient } from './KafKaAdminClient';

import { ISchemaRegistryService } from './interfaces/schema-registry-service.interface';

export class KafkaProducer {
  private producer: Producer;
  private kafka: Kafka;
  private context: string = 'KafkaProducer';
  private isConnected = false;

  constructor(
    config: KafkaConfig,
    private moduleRef: ModuleRef,
    private readonly logger: LoggerService,
    private readonly schemaRegistryClient: ISchemaRegistryService,
  ) {
    // Enhanced Kafka configuration with proper retry and connection settings
    const enhancedConfig: KafkaConfig = {
      ...config,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000,
        multiplier: 2,
        factor: 0.2,
        ...config.retry,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    };

    this.kafka = new Kafka(enhancedConfig);
    this.producer = this.kafka.producer({
      idempotent: true,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        maxRetryTime: 30000,
      },
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.producer.connect();
        this.isConnected = true;
        this.logger.info('Producer connected successfully', this.context);
      }
    } catch (error) {
      this.logger.error(`Failed to connect producer: ${error.message}`, this.context);
      throw error;
    }
  }

  async send(
    topic: string,
    messageObj: {
      key: string;
      value: unknown[];
    },
  ): Promise<RecordMetadata[]> {
    this.logger.info(`Sending message to topic: ${topic}`, this.context);

    // Ensure producer is connected
    if (!this.isConnected) {
      await this.connect();
    }

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
    const schemaId = await this.schemaRegistryClient.getLatestSchemaId(topic);
    this.logger.debug(`SchemaId returned ${schemaId}`, this.context);
    const schemaFetched = await this.schemaRegistryClient.getSchema(schemaId);
    console.info(`Schema returned: ${JSON.stringify(schemaFetched)}`);
    const encodedMessages = await Promise.all(
      messageObj.value.map(async (msg) => {
        const validMessage = this.validateMessage(schemaFetched, msg);
        return this.schemaRegistryClient.encode(schemaId, validMessage);
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
    try {
      if (this.isConnected) {
        this.logger.info('Producer disconnecting from broker...', this.context);
        await this.producer.disconnect();
        this.isConnected = false;
        this.logger.info('Producer disconnected successfully', this.context);
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect producer: ${error.message}`, this.context);
      this.isConnected = false; // Reset state even on error
      throw error;
    }
  }
}
