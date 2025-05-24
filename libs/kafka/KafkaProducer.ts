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
  ) {
    const configService = this.moduleRef.get(ConfigService, { strict: false });
    const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
    this.kafka = new Kafka(config);
    this.producer = this.kafka.producer({
      idempotent: true,
    });
    this.schemaRegistry = new SchemaRegistry({
      host: schemaRegistryUrl,
      retry: { retries: 5 },
    });
  }

  async send(
    topic: string,
    messageObj: {
      key: string;
      value: unknown[];
    },
  ): Promise<RecordMetadata[]> {
    this.producer.connect();
    const logger = this.moduleRef.get(LoggerService, { strict: false });
    const kafkaAdminClient = this.moduleRef.get<KafkaAdminClient>(
      'KafkaAdminInstance',
      { strict: false },
    );
    logger.info(`Sending message to topic: ${topic}`, this.context);
    const numPartitions = await kafkaAdminClient.getNumberOfPartitions(topic);
    const assignedPartition = numPartitions % 2;
    const schemaId = await this.schemaRegistry.getLatestSchemaId(
        topic
    );
    logger.info(`SchemaId returned ${schemaId}`, this.context);
    const schemaFetched = await this.schemaRegistry.getSchema(schemaId);
    console.log(`Schema returned: ${JSON.stringify(schemaFetched)}`);
    const encodedMessages = await Promise.all(
        messageObj.value.map(async (msg) => {
          const validMessage = this.validateMessage(schemaFetched, msg);
          return this.schemaRegistry.encode(schemaId, validMessage);
        })
      );
   // console.log(`encoded message:`,encodedMessages);
  
    const recordMetaData = await this.producer.send({
        topic,
        messages: encodedMessages.map((encodedMessage, index) => ({
          key: `${messageObj.key}-${index}`,
          value: encodedMessage,
          partition: assignedPartition,
          headers: {"messageCount":messageObj.value.length.toString()},
        })),
      });
    await this.producer.disconnect();
    return recordMetaData;
    // this.producer.on('producer.network.request_timeout', (event) => {
    //     const logger = this.moduleRef.get(CustomLoggerService, { strict: false });
    //     logger.error(
    //         {
    //             message: `Failed to send message to topic: ${topic}`,
    //             error: JSON.stringify(event.payload),
    //         },
    //         this.context,
    //     );
    // });
  }

  private validateMessage(schema: any, message: any): any {
    const { fields } = schema;
    console.log(`fields:`,fields,`message:`,message);
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
