import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { ConfigService } from '@nestjs/config';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import * as path from 'path';

/**
 * Boots the application by starting both the REST HTTP server and the gRPC microservice concurrently.
 *
 * Awaits completion of both startup routines and resolves once both servers are listening.
 *
 * @returns A promise that resolves when both servers have started.
 */
async function bootstrap() {
  await Promise.all([bootStrapGrpcServer(), bootStrapRestServer()]);
}
/**
 * Bootstraps and starts the REST HTTP server for the Inventory module.
 *
 * Sets a global validation pipe, configures Swagger documentation at "inventory/docs",
 * obtains the HTTP port from ConfigService (defaults to 3003 if unset), and begins listening.
 */
async function bootStrapRestServer() {
  const app = await NestFactory.create(InventoryModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  setupSwagger(app, "inventory/docs");
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT') || 3003;
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}

/**
 * Bootstraps and starts the Inventory gRPC microservice.
 *
 * Creates a NestJS microservice using InventoryModule configured for gRPC (package `INVENTORY_PACKAGE`)
 * with the proto at `proto/inventory.proto`, and listens on 0.0.0.0:5002.
 *
 * @throws Any error encountered during microservice creation or startup (re-thrown for caller handling).
 */
async function bootStrapGrpcServer() {
  try {
    const resolvedPath = process.env.NODE_ENV === 'production'
          ? path.resolve(__dirname, '../')
          : path.resolve(process.cwd(), 'apps/inventory/src');
    console.log('🚀 Starting Inventory gRPC server...');
    const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
      InventoryModule,
      {
        transport: Transport.GRPC,
        options: {
          url: '0.0.0.0:5002',
          package: 'INVENTORY_PACKAGE',
          protoPath: path.join(resolvedPath, 'proto/inventory.proto'),
        },
      },
    );

    await grpcApp.listen();
    console.log('✅ Inventory gRPC Server started successfully on 0.0.0.0:5002');
  } catch (error) {
    console.error('❌ Error starting Inventory gRPC Server:', error);
    throw error; // Re-throw to let the caller handle it
  }
}
bootstrap();
