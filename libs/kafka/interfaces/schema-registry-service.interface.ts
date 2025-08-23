export interface ISchemaRegistryService {
  registerSchema(topic: string, schemaDefinition: any): Promise<void>;
  deleteSchema(topic: string): Promise<void>;
  decode<T = any>(message: Buffer): Promise<T>;
  getLatestSchemaId(topic: string): Promise<number>; // Add getLatestSchemaId
  encode(schemaId: number, message: any): Promise<Buffer>; // Add encode
  getSchema(schemaId: number): Promise<any>; // Add getSchema
}
