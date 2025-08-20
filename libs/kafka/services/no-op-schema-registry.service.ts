import { Injectable, Logger } from '@nestjs/common';
import { ISchemaRegistryService } from '../interfaces/schema-registry-service.interface';

@Injectable()
export class NoOpSchemaRegistryService implements ISchemaRegistryService {
  private readonly logger = new Logger(NoOpSchemaRegistryService.name);

  async registerSchema(topic: string, schemaDefinition: any): Promise<void> {
    this.logger.warn(`Schema registry is disabled. Skipping schema registration for topic: ${topic}`);
    // Optionally, you could throw an error here if schema registration is strictly required
    // even when the registry is not available, but that defeats the purpose of a no-op.
  }

  async deleteSchema(topic: string): Promise<void> {
    this.logger.warn(`Schema registry is disabled. Skipping schema deletion for topic: ${topic}`);
  }

  async decode<T = any>(message: Buffer): Promise<T> {
    this.logger.warn(`Schema registry is disabled. Cannot decode message.`);
    // Depending on your needs, you might return null, an empty object, or throw an error.
    // For now, let's return the original message as a string, or throw an error if decoding is critical.
    // For this scenario, let's assume if schema registry is off, we don't expect encoded messages.
    // So, we'll throw an error to indicate that decoding is not possible.
    throw new Error('Schema registry is disabled, cannot decode messages.');
  }

  async getLatestSchemaId(topic: string): Promise<number> {
    this.logger.warn(`Schema registry is disabled. Cannot get latest schema ID for topic: ${topic}. Returning dummy ID.`);
    return -1; // Return a dummy ID or throw an error depending on desired behavior
  }

  async encode(schemaId: number, message: any): Promise<Buffer> {
    this.logger.warn(`Schema registry is disabled. Cannot encode message for schema ID: ${schemaId}. Returning original message as buffer.`);
    // Depending on your needs, you might return the original message as a buffer, or throw an error.
    // For this scenario, let's assume if schema registry is off, we don't expect encoded messages.
    // So, we'll throw an error to indicate that encoding is not possible.
    throw new Error('Schema registry is disabled, cannot encode messages.');
  }

  async getSchema(schemaId: number): Promise<any> {
    this.logger.warn(`Schema registry is disabled. Cannot get schema for ID: ${schemaId}. Returning empty object.`);
    return {}; // Return an empty object or throw an error depending on desired behavior
  }
}
