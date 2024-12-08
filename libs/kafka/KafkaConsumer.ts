import { CustomLoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, Kafka, KafkaConfig } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

export class KafkaConsumer {
  private consumer: Consumer;
  private context: string = 'KafkaConsumer';
  private schemaRegistry: SchemaRegistry;
  
  constructor(
    config: KafkaConfig,
    private moduleRef:ModuleRef
  ) {

    const configService = moduleRef.get(ConfigService, { strict: false });
    const groupId = configService.get<string>('INVENTORY_CONSUMER_GROUP_ID');
    this.consumer = new Kafka(config).consumer({ groupId ,retry:{retries:5}});
    const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
    this.schemaRegistry = new SchemaRegistry({ host: schemaRegistryUrl ,retry: {retries: 5 }});
  }

  async subscribe(topic: string): Promise<void> {
    const logger = this.moduleRef.get(CustomLoggerService, { strict: false });
    logger.info(`Subscribing to topic ${topic}`, this.context);
    this.consumer.connect();
    this.consumer.subscribe({ topic ,fromBeginning:true});
  }

  async postSubscribeCallback(
    callback: (topic: string, partition: number, message: string) => void,
  ): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const decodedMessage = await this.schemaRegistry.decode(message.value);
        callback(topic, partition, decodedMessage.toString());
      },
    });

    this.consumer.on('consumer.rebalancing', (event) => {
      const logger = this.moduleRef.get(CustomLoggerService, { strict: false });
      logger.error(
        {
          message: `Consumer rebalancing`,
          event: JSON.stringify(event),
        },
        this.context,
      );
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
