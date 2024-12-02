import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from './middleware/proxy.middleware';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { TracerMiddleWare } from './middleware/tracer.middleware';
import { LoggerModule } from '@lib/logger/src';
import { AuthMiddleware } from './middleware/AuthMiddleWare';

@Module({
  imports: [HttpModule,LoggerModule],
  providers:[JwtAuthGuard]
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracerMiddleWare).forRoutes('*')
    .apply(AuthMiddleware,ProxyMiddleware).forRoutes({
      path: "/auth/*",
      method:RequestMethod.ALL
    },{
      path: "/orders/*",
      method:RequestMethod.ALL
    });
  }
}
