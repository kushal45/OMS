import { LoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, IHeaders, Kafka, KafkaConfig } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { IMessageHandler } from './interfaces/message-handler.interface'; // Import the new interface
import { KafkaAdminClient } from './KafKaAdminClient';

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

  async subscribe(topic: string, maxRetries = 3, initialDelayMs = 2000): Promise<void> {
    this.logger.info(`Attempting to subscribe to topic ${topic} (max retries: ${maxRetries})`, this.context);
    const kafkaAdminClient = this.moduleRef.get<KafkaAdminClient>(KafkaAdminClient, { strict: false });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`[Attempt ${attempt}/${maxRetries}] Waiting for leader election for topic ${topic} before subscribing...`, this.context);
        // waitForLeaders will use its own timeout (now 30s by default)
        await kafkaAdminClient.waitForLeaders(topic);
        this.logger.info(`[Attempt ${attempt}/${maxRetries}] Leader election complete for topic ${topic}. Proceeding to connect and subscribe.`, this.context);
        
        await this.consumer.connect(); // Connect before subscribing
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.info(`Successfully subscribed to topic ${topic} on attempt ${attempt}`, this.context);
        return; // Success
      } catch (err) {
        this.logger.error(
          JSON.stringify({
            message: `[Attempt ${attempt}/${maxRetries}] Failed during subscription process for topic ${topic}`,
            error: err.message,
            stack: err.stack, // Log stack for more details on the error from waitForLeaders or consumer.subscribe
          }),
          this.context,
        );
        if (attempt === maxRetries) {
          this.logger.error(`All ${maxRetries} attempts to subscribe to topic ${topic} failed.`, this.context);
          throw err; // Re-throw the last error if all retries fail
        }
        const delay = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        this.logger.info(`Waiting ${delay}ms before next subscribe attempt for topic ${topic}...`, this.context);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
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
