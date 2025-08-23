import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { ConfigService } from '@nestjs/config';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import * as path from 'path';

async function bootstrap() {
  await Promise.all([bootStrapGrpcServer(), bootStrapRestServer()]);
}
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

async function bootStrapGrpcServer() {
  try {
    console.log('🚀 Starting Inventory gRPC server...');
    const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
      InventoryModule,
      {
        transport: Transport.GRPC,
        options: {
          url: '0.0.0.0:5002',
          package: 'INVENTORY_PACKAGE',
          protoPath: path.join(__dirname, 'proto/inventory.proto'),
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
