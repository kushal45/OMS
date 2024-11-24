import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from '@lib/swagger/swagger.controller';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  app.useGlobalPipes(new ValidationPipe());
  app.flushLogs();
  setupSwagger(app, "auth/docs");
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT');
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}
bootstrap();
