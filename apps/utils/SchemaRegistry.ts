import { ModuleRef } from '@nestjs/core';
import { ISchemaRegistryService } from '@lib/kafka/interfaces/schema-registry-service.interface';

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