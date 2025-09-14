import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from './middleware/proxy.middleware';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './guard/jwt.auth.guard';
import { TracerMiddleWare } from './middleware/tracer.middleware';
import { LoggerModule } from '@lib/logger/src';
import { AuthMiddleware } from './middleware/AuthMiddleWare';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import * as path from 'path';
import { ThrottlerGuard, ThrottlerModule,ThrottlerModuleOptions } from '@nestjs/throttler';
 import { APP_GUARD } from '@nestjs/core';
import { WebSocketModule } from './websocket/websocket.module';

 const resolvedPath = process.env.NODE_ENV === 'production'
   ? path.resolve(__dirname, '../')
   : path.resolve(process.cwd(), 'apps/api-gateway');
 const resolvedEnvPath = `${resolvedPath}/.env`;
@Module({
  imports: [
    HttpModule,
    LoggerModule,
    WebSocketModule,
    ConfigModule.forRoot({
      envFilePath: resolvedEnvPath,
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule], // Ensure ConfigModule is imported to use ConfigService
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        // signOptions can be omitted if gateway only verifies
      }),
    }),
    ThrottlerModule.forRootAsync({ // Temporarily commented out
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: parseInt(config.get<string>('THROTTLE_TTL'), 10) || 60, // Default to 60 seconds if not set
            limit: parseInt(config.get<string>('THROTTLE_LIMIT'), 10) || 10, // Default to 10 requests if not set
          }
        ]
      }),
    }),
  ],
  providers: [
    JwtAuthGuard,
    { // Temporarily commented out
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracerMiddleWare).forRoutes('*')
    .apply(AuthMiddleware,ProxyMiddleware).forRoutes({
      path: "/auth/*",
      method:RequestMethod.ALL
    },{
      path: "/order/*",
      method:RequestMethod.ALL
    });
  }
}
