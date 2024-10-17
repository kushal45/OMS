import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  const config = new DocumentBuilder()
    .setTitle('Auth Microservice')
    .setDescription('Authentication API documentation')
    .setVersion('1.0')
    .addBearerAuth() // Optional: for JWT or Bearer token authentication
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('order/docs', app, document); // Custom route for Swagger UI
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT');
  await app.listen(port);
}
bootstrap();
