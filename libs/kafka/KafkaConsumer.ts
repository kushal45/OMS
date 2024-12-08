import { CustomLoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, Kafka, KafkaConfig } from 'kafkajs';

export class KafkaConsumer {
  private consumer: Consumer;
  private context: string = 'KafkaConsumer';

  constructor(
    config: KafkaConfig,
    private moduleRef:ModuleRef
  ) {
    const configService = moduleRef.get(ConfigService, { strict: false });
    const groupId = configService.get<string>('INVENTORY_CONSUMER_GROUP_ID');
    this.consumer = new Kafka(config).consumer({ groupId ,retry:{retries:5}});
  }

  async subscribe(topic: string): Promise<void> {
    const logger = this.moduleRef.get(CustomLoggerService, { strict: false });
    logger.info(`Subscribing to topic ${topic}`, this.context);
    this.consumer.connect();
    this.consumer.subscribe({ topic });
  }

  async postSubscribeCallback(
    callback: (topic: string, partition: number, message: string) => void,
  ): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        callback(topic, partition, message.value.toString());
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
