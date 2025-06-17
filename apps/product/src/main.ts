import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product.module';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import * as path from 'path'; // Import path
import { LoggerService } from '@lib/logger/src'; // Import LoggerService

async function bootstrap() {
  const app = await NestFactory.create(ProductModule);
  app.useGlobalPipes(new CustomValidationPipe());
  // app.flushLogs(); // Removed, as LoggerService handles this

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService); // Get LoggerService instance

  // Setup gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'product', // Must match the package name in product.proto
      protoPath: path.resolve('apps/product/src/proto/product.proto'), // Path to the .proto file
      url: configService.get<string>('PRODUCT_GRPC_URL', '0.0.0.0:5001'), // gRPC listening address
    },
  });

  await app.startAllMicroservices(); // Start all microservices (gRPC in this case)

  setupSwagger(app, "product/docs"); // Keep Swagger for HTTP

  const httpPort = configService.get<number>('PORT') || 3004;
  await app.listen(httpPort); // Start HTTP server

  logger.info(`Product HTTP service listening on port ${httpPort}`, 'Bootstrap');
  logger.info(`Product gRPC service listening on ${configService.get<string>('PRODUCT_GRPC_URL', '0.0.0.0:5001')}`, 'Bootstrap');
}
bootstrap();
