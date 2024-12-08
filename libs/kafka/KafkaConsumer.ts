import { CustomLoggerService } from '@lib/logger/src';
import { Consumer, Kafka, KafkaConfig } from 'kafkajs';

export class KafkaConsumer {
  private consumer: Consumer;
  private context: string = 'KafkaConsumer';

  constructor(
    config: KafkaConfig,
    private logger: CustomLoggerService,
    groupId: string,
  ) {
    this.consumer = new Kafka(config).consumer({ groupId });
  }

  async subscribe(topic: string): Promise<void> {
    this.logger.info(`Subscribing to topic ${topic}`, this.context);
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
      this.logger.error(
        {
          message: `Consumer rebalancing`,
          event: JSON.stringify(event),
        },
        this.context,
      );
    });

    this.consumer.on('consumer.heartbeat', (event) => {
      this.logger.info(
        {
          message: `Consumer heartbeat`,
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
