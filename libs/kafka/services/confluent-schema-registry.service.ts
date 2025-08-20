import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchemaRegistry, SchemaType, COMPATIBILITY } from '@kafkajs/confluent-schema-registry';
import axios from 'axios';
import { ISchemaRegistryService } from '../interfaces/schema-registry-service.interface';

@Injectable()
export class ConfluentSchemaRegistryService implements ISchemaRegistryService {
  private readonly logger = new Logger(ConfluentSchemaRegistryService.name);
  private schemaRegistry: SchemaRegistry;
  private schemaRegistryUrl: string;

  constructor(private configService: ConfigService) {
    this.schemaRegistryUrl = this.configService.get<string>('SCHEMA_REGISTRY_URL');
    if (!this.schemaRegistryUrl) {
      this.logger.error('SCHEMA_REGISTRY_URL is not defined in configuration.');
      throw new Error('SCHEMA_REGISTRY_URL is not defined.');
    }
    this.schemaRegistry = new SchemaRegistry({ host: this.schemaRegistryUrl });
  }

  async registerSchema(topic: string, schemaDefinition: any): Promise<void> {
    this.logger.log(`Attempting to register schema for topic: ${topic}`);
    if (!topic || !schemaDefinition) {
      this.logger.error('Topic and schemaDefinition are required for schema registration.');
      throw new Error('Topic and schemaDefinition are required for schema registration.');
    }

    try {
      // Set compatibility to NONE before attempting to register
      const compatibilityUrl = `${this.schemaRegistryUrl}/config/${topic}`;
      try {
        this.logger.log(`Setting compatibility to NONE for subject: ${topic} at ${compatibilityUrl}`);
        await axios.put(compatibilityUrl, { compatibility: 'NONE' }, {
          headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' }
        });
        this.logger.log(`Successfully set compatibility to NONE for subject: ${topic}`);
      } catch (compatError: any) {
        this.logger.warn(`Could not set compatibility for subject ${topic}: ${compatError.message}. Proceeding with registration attempt.`);
        if (compatError.response) {
          this.logger.warn(`Compatibility error response: ${JSON.stringify(compatError.response.data)}`);
        }
      }

      const response = await this.schemaRegistry.register(
        {
          type: SchemaType.AVRO,
          schema: JSON.stringify(schemaDefinition),
        },
        { subject: topic, compatibility: COMPATIBILITY.NONE },
      );

      this.logger.log(`Schema registered with id: ${response.id}`);
      const schemaId = await this.schemaRegistry.getLatestSchemaId(topic);
      this.logger.log(`SchemaId returned: ${schemaId}`);
      const schemaFetched = await this.schemaRegistry.getSchema(schemaId);
      this.logger.log(`Schema returned: ${JSON.stringify(schemaFetched)}`);

    } catch (error: any) {
      this.logger.error(`Failed to register schema for topic ${topic}: ${error.message}`);
      if (error.response) {
        this.logger.error(`Schema registration error response: ${JSON.stringify(error.response.data)}`);
      }
      throw error; // Re-throw to allow calling context to handle
    }
  }

  async deleteSchema(topic: string): Promise<void> {
    this.logger.log(`Attempting to delete schema for topic: ${topic}`);
    if (!topic) {
      this.logger.error('Topic is required for schema deletion.');
      throw new Error('Topic is required for schema deletion.');
    }

    const url = `${this.schemaRegistryUrl}/subjects/${topic}`;
    try {
      const response = await axios.delete(url);
      this.logger.log(`Schema deleted: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete schema for topic ${topic}: ${error.message}`);
      if (error.response) {
        this.logger.error(`Schema deletion error response: ${JSON.stringify(error.response.data)}`);
      }
      throw error; // Re-throw to allow calling context to handle
    }
  }

  async decode<T = any>(message: Buffer): Promise<T> {
    if (!this.schemaRegistry) {
      throw new Error('SchemaRegistry is not initialized.');
    }
    return this.schemaRegistry.decode(message);
  }

  async getLatestSchemaId(topic: string): Promise<number> {
    if (!this.schemaRegistry) {
      throw new Error('SchemaRegistry is not initialized.');
    }
    return this.schemaRegistry.getLatestSchemaId(topic);
  }

  async encode(schemaId: number, message: any): Promise<Buffer> {
    if (!this.schemaRegistry) {
      throw new Error('SchemaRegistry is not initialized.');
    }
    return this.schemaRegistry.encode(schemaId, message);
  }

  async getSchema(schemaId: number): Promise<any> {
    if (!this.schemaRegistry) {
      throw new Error('SchemaRegistry is not initialized.');
    }
    return this.schemaRegistry.getSchema(schemaId);
  }
}
