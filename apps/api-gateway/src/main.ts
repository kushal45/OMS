import { NestFactory, Reflector } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { HttpService } from '@nestjs/axios';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule,{ bodyParser: false });
  //const globalPrefix = 'api';
  //app.setGlobalPrefix(globalPrefix);
  const AUTH_SERVICE_URL = 'http://auth:3001';
  const ORDER_SERVICE_URL = 'http://order:3002';
  const httpService = app.get(HttpService);

  // Apply JwtAuthGuard globally
  app.useGlobalGuards(new JwtAuthGuard(httpService));
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
