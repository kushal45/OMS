import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { ConfigService } from '@nestjs/config';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path'

async function bootstrap() {

  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(InventoryModule, {
    transport: Transport.GRPC,
    options: {
      url:"0.0.0.0:5002",
      package: 'INVENTORY_PACKAGE',
      protoPath: path.resolve('apps/inventory/src/proto/inventory.proto'),
    },
  });
   grpcApp.listen().then((response) => {
    console.log("port response",response);
   });
  console.log('GRPC Server started');

  const app = await NestFactory.create(InventoryModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT') || 3003;
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}
bootstrap();
