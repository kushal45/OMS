import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import axios from 'axios';

export async function registerSchema(moduleRef: ModuleRef) {
  const configService = moduleRef.get(ConfigService, { strict: false });
  const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
  const schemaRegistry = new SchemaRegistry(
    { host: schemaRegistryUrl },
   
  );
  const topic = configService.get<string>('INVENTORY_UPDATE_TOPIC');
  console.log(`Registering schema for topic: ${topic}`);
  const schema = {
    type: 'record',
    name: `${topic}`, // Ensure the schema name is the same as the existing schema
    fields: [
      { name: 'productId', type: 'int' },
      { name: 'price', type: 'int' },
      { name: 'quantity', type: 'int' },
    ],
  };
  
  try {
    await deleteSchema(moduleRef);
    const response = await schemaRegistry.register({
      type: SchemaType.AVRO,
      schema: JSON.stringify(schema),
    }, { subject: topic });

    console.log(`Schema registered with id: ${response.id}`);
    const schemaId=await schemaRegistry.getLatestSchemaId(topic);
    console.log(`SchemaId returned: ${schemaId}`);
    const schemaFetched = await schemaRegistry.getSchema(schemaId);
    
    console.log(`Schema returned: ${JSON.stringify(schemaFetched)}`);
  } catch (error) {
    console.error(`Failed to register schema: ${error.message}`);
  }
}

export async function deleteSchema(moduleRef: ModuleRef) {
  const configService = moduleRef.get(ConfigService, { strict: false });
  const schemaRegistryUrl = configService.get<string>('SCHEMA_REGISTRY_URL');
  const topic = configService.get<string>('INVENTORY_UPDATE_TOPIC');
  console.log(`Deleting schema for topic: ${topic}`);

  const url = `${schemaRegistryUrl}/subjects/${topic}`;
  try {
    const response = await axios.delete(url);
    console.log(`Schema deleted: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error(`Failed to delete schema: ${error.message}`);
  }
}
