import { LoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, IHeaders, Kafka, KafkaConfig } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

export class KafkaConsumer {
  private consumer: Consumer;
  private context: string = 'KafkaConsumer';
  private schemaRegistry: SchemaRegistry;
  
  constructor(
    config: KafkaConfig,
    private moduleRef: ModuleRef,
    private logger: LoggerService,
  ) {
    const configService = moduleRef.get(ConfigService, { strict: false });
    const groupId = configService.get<string>('INVENTORY_CONSUMER_GROUP_ID');
    this.consumer = new Kafka(config).consumer({ groupId, retry: { retries: 5 } });
    const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
    this.schemaRegistry = new SchemaRegistry({ host: schemaRegistryUrl, retry: { retries: 5 } });
  }

  async subscribe(topic: string): Promise<void> {
    this.logger.info(`Subscribing to topic ${topic}`, this.context);
    this.consumer.connect();
    this.consumer.subscribe({ topic, fromBeginning: true });
  }

  async postSubscribeCallback(
    callback: (topic: string, partition: number, message: string, headers: IHeaders) => void,
  ): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const decodedMessage = await this.schemaRegistry.decode(message.value);
        const headers = message.headers;
        callback(topic, partition, decodedMessage.toString(), headers);
      },
    });

    this.consumer.on('consumer.rebalancing', (event) => {
      this.logger.error(
        JSON.stringify({
          message: `Consumer rebalancing`,
          event,
        }),
        this.context,
      );
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
