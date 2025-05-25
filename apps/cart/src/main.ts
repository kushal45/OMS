import { NestFactory } from '@nestjs/core';
import { CartModule } from './cart.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from '@lib/swagger/swagger.controller';
import { CustomValidationPipe } from '@lib/http/custom-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(CartModule);
  app.useGlobalPipes(new CustomValidationPipe());
  app.flushLogs();
  setupSwagger(app,"cart/docs");
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3004; // Defaulting to 3004 for cart service
  console.log(`Cart service listening on port ${port}`);
  await app.listen(port);
}
bootstrap();