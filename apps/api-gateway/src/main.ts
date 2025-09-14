import { NestFactory, Reflector } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  //const httpService = app.get(HttpService);
  //app.useGlobalGuards(new JwtAuthGuard(httpService));
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  
  // Enable CORS for both HTTP and WebSocket
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });
  
  console.log('🚀 API Gateway starting with WebSocket support...');
  console.log('📡 WebSocket endpoint: ws://localhost:3000/events');
  console.log('🔗 HTTP API endpoint: http://localhost:3000');
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);

}
bootstrap();
