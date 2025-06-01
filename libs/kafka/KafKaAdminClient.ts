import { LoggerService } from '@lib/logger/src';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Admin, KafkaConfig, Kafka, ITopicMetadata } from 'kafkajs';

@Injectable()
export class KafkaAdminClient {
  private static kafkaAdminClient: Admin;
  private context: string = 'KafkaAdminClient';
  private logger: LoggerService;
  private isConnected: boolean = false;
  constructor(
    config: KafkaConfig,
    private readonly moduleRef: ModuleRef, // moduleRef might still be needed for other purposes or can be removed if not used elsewhere
    loggerService: LoggerService, // Add loggerService parameter
  ) {
    // create a single instance of KafkaAdminClient
    if (!KafkaAdminClient.kafkaAdminClient) {
      const kafka = new Kafka(config);
      KafkaAdminClient.kafkaAdminClient = kafka.admin();
    }
    this.logger = loggerService; // Use the injected loggerService
  }

  async fetchTopicMetadata(topics: string[]): Promise<Array<ITopicMetadata>> {
    try {
      const metadata =
        await KafkaAdminClient.kafkaAdminClient.fetchTopicMetadata({ topics });
      return metadata.topics;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          message: `Failed to fetch topic metadata for topics: ${topics.join(', ')}`,
          error: error.message,
        }),
        this.context,
      );
      throw new Error(`Failed to fetch topic metadata: ${error.message}`);
    }
  }
  async createTopic(topicName: string): Promise<void> {
    try {
      await KafkaAdminClient.kafkaAdminClient.connect();
      const topics = await this.listTopics();
      this.logger.info(`Topics: ${JSON.stringify(topics)}`, this.context);
      if (!topics.includes(topicName) || topics.length === 0) {
        console.log(`Creating topic ${topicName}`);
        await this.retryCreateTopic(topicName);
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          message: `Failed to create topic ${topicName}`,
          error: error.message,
        }),
        this.context,
      );
    }
  }

  async retryCreateTopic(topicName: string, retries = 5): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await KafkaAdminClient.kafkaAdminClient.createTopics({
          topics: [
            {
              topic: topicName,
              numPartitions: 3,
            },
          ],
        });
        this.logger.info(
          `Successfully created topic ${topicName} on attempt ${attempt}`,
          this.context,
        );
        return;
      } catch (error) {
        if (attempt === retries) {
          this.logger.error(
            `Failed to create topic ${topicName} after ${retries} attempts`,
            this.context,
            error, // Pass the full error object
          );
          throw new Error(
            `Failed to create topic ${topicName} after ${retries} attempts: ${error.message}`,
          );
        }
      }
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    if ((await this.fetchTopicMetadata([topicName])).length > 0) {
      console.log(`Deleting topic ${topicName}`);
      await KafkaAdminClient.kafkaAdminClient.deleteTopics({
        topics: [topicName],
      });
    }
  }
  async listTopics(): Promise<string[]> {
    this.logger.info('Listing topics', this.context);
    return await KafkaAdminClient.kafkaAdminClient.listTopics();
  }

  async describeTopic(topicName: string): Promise<string> {
    const topicMetadata = await this.fetchTopicMetadata([topicName]);
    return JSON.stringify(topicMetadata[0]);
  }

  async getNumberOfPartitions(topic: string): Promise<number> {
    try {
      const admin = KafkaAdminClient.kafkaAdminClient;
      await admin.connect();
      this.isConnected = true; // Set isConnected to true after successful connection
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      const topicMetadata = metadata.topics.find((t) => t.name === topic);

      if (!topicMetadata) {
        throw new Error(`Topic "${topic}" not found`);
      }
     // await admin.disconnect();
      return topicMetadata.partitions.length; // Number of partitions
    } catch (error) {
      this.logger.error(
        `Failed to get number of partitions for topic ${topic}`,
        this.context,
        error, // Pass the full error object
      );
      throw new Error(
        `Failed to get number of partitions for topic ${topic}: ${error.message}`,
      );
    }
  }

  async listPartitions(topic: string): Promise<number[]> {
    try {
      const admin = KafkaAdminClient.kafkaAdminClient;
      if (!this.isConnected) {
        await admin.connect();
        this.isConnected = true; // Set isConnected to true after successful connection
      }
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      const topicMeta = metadata.topics.find((t) => t.name === topic);
      if (!topicMeta) throw new Error(`Topic ${topic} not found`);
      return topicMeta.partitions.map((p) => p.partitionId);
    } catch (error) {
      this.logger.error(
        `Failed to list partitions for topic ${topic}`,
        this.context,
        error, // Pass the full error object
      );
      throw new Error(
        `Failed to list partitions for topic ${topic}: ${error.message}`,
      );
    }
  }

  async close(): Promise<void> {
    await KafkaAdminClient.kafkaAdminClient.disconnect();
  }
}
