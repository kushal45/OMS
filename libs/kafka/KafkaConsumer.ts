import { LoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Consumer, IHeaders, Kafka, KafkaConfig } from 'kafkajs';
import { IMessageHandler } from './interfaces/message-handler.interface';
import { KafkaAdminClient } from './KafKaAdminClient';
import { ISchemaRegistryService } from './interfaces/schema-registry-service.interface'; // New import
import { Inject } from '@nestjs/common'; // Import Inject
import { SCHEMA_REGISTRY_SERVICE_TOKEN } from './schema-registry.module'; // Import the token

export class KafkaConsumer {
  private consumer: Consumer;
  private context: string = 'KafkaConsumer';
  private isConnected: boolean = false;
  private kafka: Kafka;

  constructor(
    config: KafkaConfig,
    private moduleRef: ModuleRef,
    private logger: LoggerService,
    @Inject(SCHEMA_REGISTRY_SERVICE_TOKEN) private schemaRegistryService: ISchemaRegistryService, // Injected service
  ) {
    const configService = moduleRef.get(ConfigService, { strict: false });
    const groupId = configService.get<string>('INVENTORY_CONSUMER_GROUP_ID');

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
    this.consumer = this.kafka.consumer({
      groupId,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        maxRetryTime: 30000,
      },
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
    });
  }

  async subscribe(topic: string, maxRetries = 3, initialDelayMs = 2000): Promise<void> {
    this.logger.info(`Attempting to subscribe to topic ${topic} (max retries: ${maxRetries})`, this.context);
    const kafkaAdminClient = this.moduleRef.get<KafkaAdminClient>(KafkaAdminClient, { strict: false });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`[Attempt ${attempt}/${maxRetries}] Waiting for leader election for topic ${topic} before subscribing...`, this.context);
        await kafkaAdminClient.waitForLeaders(topic);
        this.logger.info(`[Attempt ${attempt}/${maxRetries}] Leader election complete for topic ${topic}. Proceeding to connect and subscribe.`, this.context);

        // Only connect if not already connected
        if (!this.isConnected) {
          await this.consumer.connect();
          this.isConnected = true;
          this.logger.info(`Consumer connected successfully for topic ${topic}`, this.context);
        }

        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.info(`Successfully subscribed to topic ${topic} on attempt ${attempt}`, this.context);
        return;
      } catch (err: any) {
        this.logger.error(
          JSON.stringify({
            message: `[Attempt ${attempt}/${maxRetries}] Failed during subscription process for topic ${topic}`,
            error: err.message,
            stack: err.stack,
          }),
          this.context,
        );

        // Reset connection state on error
        this.isConnected = false;

        // Try to disconnect gracefully before retrying
        try {
          await this.consumer.disconnect();
        } catch (disconnectErr) {
          this.logger.error(`Failed to disconnect consumer during retry: ${disconnectErr.message}`, this.context);
        }

        if (attempt === maxRetries) {
          this.logger.error(`All ${maxRetries} attempts to subscribe to topic ${topic} failed.`, this.context);
          throw err;
        }
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        this.logger.info(`Waiting ${delay}ms before next subscribe attempt for topic ${topic}...`, this.context);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async postSubscribeCallback(handler: IMessageHandler): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const decodedMessage = await this.schemaRegistryService.decode(message.value as Buffer); // Use injected service
          const headers = message.headers;
          await handler.handleMessage(topic, partition, decodedMessage, headers);
        } catch (error: any) {
          this.logger.error(
            JSON.stringify({
              message: `Error processing message from topic ${topic} in partition ${partition}`,
              errorMessage: error.message,
              errorStack: error.stack,
              originalMessageValue: message.value?.toString(),
            }),
            this.context,
          );
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
    try {
      if (this.isConnected) {
        await this.consumer.disconnect();
        this.isConnected = false;
        this.logger.info('Consumer disconnected successfully', this.context);
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect consumer: ${error.message}`, this.context);
      throw error;
    }
  }
}