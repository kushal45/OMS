import { NestFactory } from '@nestjs/core';
import { InventoryModule } from './inventory.module';
import { ConfigService } from '@nestjs/config';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';

async function bootstrap() {
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
