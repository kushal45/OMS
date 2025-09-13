import { NestFactory } from '@nestjs/core';
import { CartModule } from './cart.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import  { join ,resolve} from 'path';

async function bootstrap() {
  const app = await NestFactory.create(CartModule);
  app.useGlobalPipes(new CustomValidationPipe());

  const configService = app.get(ConfigService);

  // gRPC Microservice Configuration
  const resolvedPath = process.env.NODE_ENV === 'production'
    ? resolve(__dirname, '../')
    : resolve(process.cwd(), 'apps/cart/src');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'cart', // Package name from cart.proto
      protoPath: join(resolvedPath, 'proto/cart.proto'), // Path to cart.proto
      url: configService.get<string>('GRPC_URL', '0.0.0.0:5005'), // gRPC listening URL
    },
  });

  await app.startAllMicroservices();
  app.flushLogs();
  setupSwagger(app, "cart/docs");

  const port = configService.get<number>('PORT') || 3005; // HTTP port
  console.log(`Cart HTTP service listening on port ${port}`);
  console.log(`Cart gRPC service listening on ${configService.get<string>('GRPC_URL', '0.0.0.0:5005')}`);
  await app.listen(port);
}
bootstrap();