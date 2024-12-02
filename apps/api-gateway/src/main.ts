import { NestFactory, Reflector } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { HttpService } from '@nestjs/axios';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule,{ bodyParser: false });
  //const httpService = app.get(HttpService);
  //app.useGlobalGuards(new JwtAuthGuard(httpService));
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  app.enableCors();
  await app.listen(3000);

}
bootstrap();
