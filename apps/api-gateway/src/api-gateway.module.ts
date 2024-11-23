import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from './middleware/proxy.middleware';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { Reflector } from '@nestjs/core';
import { TracerMiddleWare } from './middleware/tracer.middleware';

@Module({
  imports: [HttpModule],
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
    }).apply(TracerMiddleWare).forRoutes('*');
  }
}
