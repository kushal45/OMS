import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product.module';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(ProductModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  const configService = app.get(ConfigService);
  console.log(configService);
  const port = configService.get<number>('PORT') || 3004;
  console.log(`Listening on port ${port}`);
  await app.listen(port);
}
bootstrap();
