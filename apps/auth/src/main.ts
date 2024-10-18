import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const config = new DocumentBuilder()
    .setTitle('Auth Microservice')
    .setDescription('Authentication API documentation')
    .setVersion('1.0')
    .addBearerAuth() // Optional: for JWT or Bearer token authentication
    .build();
  app.useGlobalPipes(new ValidationPipe());
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('auth/docs', app, document); // Custom route for Swagger UI
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT');
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}
bootstrap();
