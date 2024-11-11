import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { ProxyMiddleware } from './middleware/proxy.middleware';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { Reflector } from '@nestjs/core';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [HttpModule],
  controllers: [ApiGatewayController],
  providers:[JwtAuthGuard,Reflector]
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProxyMiddleware).forRoutes({
      path: "/auth/*",
      method:RequestMethod.ALL
    },{
      path: "/order/*",
      method:RequestMethod.ALL
    }).apply(LoggerMiddleware).forRoutes('*');
  }
}
