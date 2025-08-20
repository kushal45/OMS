import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfluentSchemaRegistryService } from './services/confluent-schema-registry.service';
import { NoOpSchemaRegistryService } from './services/no-op-schema-registry.service';
import { ISchemaRegistryService } from './interfaces/schema-registry-service.interface';

export const SCHEMA_REGISTRY_SERVICE_TOKEN = 'ISchemaRegistryService'; // Define a string token

const schemaRegistryServiceProvider: Provider = {
  provide: SCHEMA_REGISTRY_SERVICE_TOKEN, // Use the string token
  useFactory: (configService: ConfigService) => {
    const isSchemaRegistryEnabled = configService.get<boolean>('SCHEMA_REGISTRY_ENABLED', false);
    if (isSchemaRegistryEnabled) {
      return new ConfluentSchemaRegistryService(configService);
    } else {
      return new NoOpSchemaRegistryService();
    }
  },
  inject: [ConfigService],
};

@Global() // Make it global if many modules need it, or import it specifically
@Module({
  providers: [schemaRegistryServiceProvider],
  exports: [SCHEMA_REGISTRY_SERVICE_TOKEN], // Export the string token
})
export class SchemaRegistryModule {}
