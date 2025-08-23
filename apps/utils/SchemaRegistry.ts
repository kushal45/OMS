import { ModuleRef } from '@nestjs/core';
import { ISchemaRegistryService } from '@lib/kafka/interfaces/schema-registry-service.interface';

/**
 * Register (replace) a Kafka topic schema using the injected schema registry service.
 *
 * Deletes any existing schema for the given topic, parses `schemaJsonString` into an object,
 * and registers the parsed schema via the injected service. If `schemaJsonString` is falsy
 * or cannot be parsed as valid JSON the function returns early after logging an error.
 *
 * @param topic - Kafka topic name whose schema will be replaced.
 * @param schemaJsonString - JSON string containing the schema to register; must be valid JSON.
 * @param processType - One of `'reserve' | 'release' | 'replenish'`; used only to tailor the missing-schema error message.
 */
export async function handleInventoryProcessTypeRegistration(
  topic: string,
  schemaJsonString: string,
  moduleRef: ModuleRef,
  schemaRegistryService: ISchemaRegistryService, // Injected service
  processType: 'reserve' | 'release' | 'replenish' = 'reserve',
) {
  try {
    console.log(`Registering schema for topic: ${topic}`);
    await schemaRegistryService.deleteSchema(topic); // Use injected service
    if (!schemaJsonString) {
      console.error(
        `Schema JSON string not found in config for topic: ${topic}. Ensure  ${processType} json is set in the .env file.`,
      );
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
      return;
    }

    console.log(
      `Schema definition for topic ${topic}: ${JSON.stringify(parsedSchema)}`,
    );
    await schemaRegistryService.registerSchema(topic, parsedSchema); // Use injected service
  } catch (error) {
    console.error(
      `Error during schema registration for topic ${topic}:`,
      error,
    );
    return;
  }
}