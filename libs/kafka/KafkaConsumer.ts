import { LoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, IHeaders, Kafka, KafkaConfig } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { IMessageHandler } from './interfaces/message-handler.interface'; // Import the new interface

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

  async postSubscribeCallback(handler: IMessageHandler): Promise<void> { // Accept IMessageHandler
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const decodedMessage = await this.schemaRegistry.decode(message.value);
          const headers = message.headers;
          // Call the handler's handleMessage method
          await handler.handleMessage(topic, partition, decodedMessage, headers);
        } catch (error) {
          this.logger.error(
            JSON.stringify({
              message: `Error processing message from topic ${topic} in partition ${partition}`,
              errorMessage: error.message,
              errorStack: error.stack,
              originalMessageValue: message.value?.toString(), // Log raw message value on error
            }),
            this.context,
          );
          // Depending on the desired behavior, you might want to:
          // - Throw the error to stop the consumer (if it's a critical, unrecoverable error)
          // - Log and continue (current behavior)
          // - Move the message to a dead-letter queue (DLQ) - more advanced setup
        }
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
