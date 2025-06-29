import { SchemaRegistry, SchemaType, COMPATIBILITY } from '@kafkajs/confluent-schema-registry';
import { LoggerService } from '@lib/logger/src';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import axios from 'axios';


 export async function handleInventoryProcessTypeRegistration(
    topic: string,
    schemaJsonString: string,
    moduleRef: ModuleRef,
    processType: 'reserve' | 'release'| 'replenish' = 'reserve',
  ) {
    try {
      console.log(`Registering schema for topic: ${topic}`);
      await deleteSchema(moduleRef, topic);
      if (!schemaJsonString) {
        console.error(
          `Schema JSON string not found in config for topic: ${topic}. Ensure  ${processType} json is set in the .env file.`,
        );
        // Potentially throw an error or handle as appropriate for your application
        return;
      }

      let parsedSchema;
      try {
        parsedSchema = JSON.parse(schemaJsonString);
      } catch (error) {
        console.error(
          `Error parsing schema JSON string for topic ${topic}:`,
          error,
          `Schema string: ${schemaJsonString}`,
        );
        // Potentially throw an error or handle as appropriate
        return;
      }

      console.log(
        `Schema definition for topic ${topic}: ${JSON.stringify(parsedSchema)}`,
      );
      await registerSchema(moduleRef, topic, parsedSchema);
    } catch (error) {
      console.error(
        `Error during schema registration for topic ${topic}:`,
        error,
      );
      // Depending on the desired behavior, you might want to:
      // - Throw the error to stop the process (if it's critical)
      // - Log and continue (current behavior)
      // - Handle the error in a way that allows the application to recover
      return;
    }
  }

async function registerSchema(
  moduleRef: ModuleRef,
  topic: string,
  schemaDefinition: any,
) {
  const logger = moduleRef.get(LoggerService, { strict: false });
  logger.info(`Registering schema for topic: ${topic}`);
  if (!topic) {
    throw new Error('Topic is required for schema registration');
  }
  const configService = moduleRef.get(ConfigService, { strict: false });
  const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
  const schemaRegistry = new SchemaRegistry({ host: schemaRegistryUrl });

  try {
    // Set compatibility to NONE before attempting to register
    const compatibilityUrl = `${schemaRegistryUrl}/config/${topic}`;
    try {
      logger.info(`Setting compatibility to NONE for subject: ${topic} at ${compatibilityUrl}`);
      await axios.put(compatibilityUrl, { compatibility: 'NONE' }, {
        headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' }
      });
      logger.info(`Successfully set compatibility to NONE for subject: ${topic}`);
    } catch (compatError) {
      logger.info(`Could not set compatibility for subject ${topic}: ${compatError.message}. Proceeding with registration attempt.`);
      if (compatError.response) {
        logger.info(`Compatibility error response: ${JSON.stringify(compatError.response.data)}`);
      }
    }
    
    await registerSchemaWithRegistry(schemaRegistry, topic, schemaDefinition);

  } catch (error) {
    logger.error(`Error during schema registration process for topic ${topic}: ${error.message}`);
    if (error.response) {
        logger.error(`Schema registration error response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function registerSchemaWithRegistry(
  schemaRegistry: SchemaRegistry,
  topic: string,
  schemaDefinition: any,
) {
  try {
    console.log(`Registering schema for topic: ${topic}`);
    if (!schemaDefinition) {
      throw new Error('schemaDefinition is required for schema registration');
    }
    const response = await schemaRegistry.register(
      {
        type: SchemaType.AVRO,
        schema: JSON.stringify(schemaDefinition),
      },
      { subject: topic, compatibility: COMPATIBILITY.NONE },
    );

    console.log(`Schema registered with id: ${response.id}`);
    const schemaId = await schemaRegistry.getLatestSchemaId(topic);
    console.log(`SchemaId returned: ${schemaId}`);
    const schemaFetched = await schemaRegistry.getSchema(schemaId);

    console.log(`Schema returned: ${JSON.stringify(schemaFetched)}`);
  } catch (error) {
    console.error(`Failed to register schema for topic ${topic}:`, error);
  }
}

export async function deleteSchema(moduleRef: ModuleRef, topic: string) {
  if (!topic) {
    throw new Error('Topic is required for schema deletion');
  }
  const configService = moduleRef.get(ConfigService, { strict: false });
  const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
  console.log(`Deleting schema for topic: ${topic}`);

  const url = `${schemaRegistryUrl}/subjects/${topic}`;
  try {
    const response = await axios.delete(url);
    console.log(`Schema deleted: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error(`Failed to delete schema: ${error.message}`);
  }
}
