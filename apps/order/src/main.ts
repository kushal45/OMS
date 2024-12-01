import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  setupSwagger(app,"order/docs");
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT');
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}
bootstrap();
