import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { ConfigService } from '@nestjs/config';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';

async function bootstrap() {
  Promise.all([ bootStrapGrpcServer(),bootStrapRestServer()]);
}
async function bootStrapRestServer() {
  const app = await NestFactory.create(InventoryModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT') || 3003;
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}

async function bootStrapGrpcServer() {
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
  grpcApp
    .listen()
    .then(() => {
      console.log('GRPC Server started');
    })
    .catch((error) => {
      console.error('Error starting GRPC Server:', error);
      setTimeout(bootStrapGrpcServer, 2000); // Retry after 5 seconds
    });
}
bootstrap();
