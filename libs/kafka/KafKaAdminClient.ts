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
      // Enhance KafkaConfig with retry settings
      const kafkaWithRetries = new Kafka({
        ...config,
        retry: {
          initialRetryTime: 300, // Initial delay in ms
          retries: 8, // Max number of retries
          maxRetryTime: 30000, // Max delay between retries
          multiplier: 2, // Exponential backoff
          factor: 0.2, // Randomness factor
          ...config.retry, // Allow overriding from incoming config if needed
        },
      });
      KafkaAdminClient.kafkaAdminClient = kafkaWithRetries.admin();
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
      if (!this.isConnected) {
        await KafkaAdminClient.kafkaAdminClient.connect();
        this.isConnected = true;
        this.logger.info('Admin client connected successfully', this.context);
      }

      const topics = await this.listTopics();
      this.logger.info(`Topics: ${JSON.stringify(topics)}`, this.context);
      if (!topics.includes(topicName) || topics.length === 0) {
        console.log(`Creating topic ${topicName}`);
        await this.retryCreateTopic(topicName);
        await this.waitForLeaders(topicName); // Wait for leader election after topic creation
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          message: `Failed to create topic ${topicName}`,
          error: error.message,
        }),
        this.context,
      );
      // Reset connection state on error
      this.isConnected = false;
      throw error;
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

  async waitForLeaders(topic: string, timeoutMs = 30000) { // Increased timeout to 30 seconds
    const start = Date.now();
    this.logger.info(`Waiting for leaders for topic ${topic} (timeout: ${timeoutMs}ms)...`, this.context);
    while (Date.now() - start < timeoutMs) {
      try {
        // Log which broker the admin client is trying to connect to if possible (KafkaJS doesn't expose this easily)
        // We can infer it if fetchTopicMetadata fails with a broker-specific error.
        this.logger.debug(`Fetching metadata for topic ${topic} in waitForLeaders loop. Elapsed: ${Date.now() - start}ms`, this.context);
        const metadata = await this.fetchTopicMetadata([topic]);
        const topicMeta = metadata.find((t) => t.name === topic);
        if (topicMeta && topicMeta.partitions.every((p) => p.leader !== -1 && p.isr.length > 0)) { // Added check for ISR > 0
          this.logger.info(`All partitions for topic ${topic} have leaders and ISR count > 0. Partitions: ${JSON.stringify(topicMeta.partitions)}`, this.context);
          return;
        }
        this.logger.debug(`Topic ${topic} still waiting for leaders or sufficient ISR. Current metadata: ${JSON.stringify(topicMeta?.partitions)}`, this.context);
      } catch (error) {
        this.logger.error(`Error fetching metadata in waitForLeaders for topic ${topic}: ${error.message}. Retrying...`, this.context);
        // Continue loop on error, relying on the main timeout
      }
      await new Promise((res) => setTimeout(res, 1000)); // Increased retry interval
    }
    
    let lastErrorMsg = 'Unknown error after timeout';
    try {
      const finalMetadataAttempt = await this.fetchTopicMetadata([topic]);
      // If fetchTopicMetadata succeeded but leaders weren't found, log that.
      // The actual check for leaders is inside the loop. This is just to get a final state.
      this.logger.error(`Timeout waiting for leaders for topic ${topic}. Final metadata attempt: ${JSON.stringify(finalMetadataAttempt)}`, this.context);
      // We can't easily get a specific "error" from a successful fetchTopicMetadata that simply shows no leaders.
      // The error we're interested in is if fetchTopicMetadata itself failed.
    } catch (e) {
      lastErrorMsg = e.message || 'Failed to fetch final metadata';
      this.logger.error(`Timeout waiting for leaders for topic ${topic}. Error during final metadata fetch: ${lastErrorMsg}`, this.context);
    }
    throw new Error(`Timeout waiting for leaders for topic ${topic}. Last known error: ${lastErrorMsg}`);
  }

  async close(): Promise<void> {
    try {
      if (this.isConnected) {
        await KafkaAdminClient.kafkaAdminClient.disconnect();
        this.isConnected = false;
        this.logger.info('Admin client disconnected successfully', this.context);
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect admin client: ${error.message}`, this.context);
      this.isConnected = false; // Reset state even on error
      throw error;
    }
  }
}
