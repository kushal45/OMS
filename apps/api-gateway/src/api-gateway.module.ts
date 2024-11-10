import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { ProxyMiddleware } from './middleware/proxy.middleware';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [HttpModule],
  controllers: [ApiGatewayController],
  providers:[JwtAuthGuard, Reflector, ProxyMiddleware]
})
export class ApiGatewayModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProxyMiddleware).forRoutes('*');
  }
}
