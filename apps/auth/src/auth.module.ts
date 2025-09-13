import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Customer } from './entity/customer.entity';
import { CustomerRepository } from './repository/customer.repository';
import { LoggerModule } from '@lib/logger/src';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AddressModule } from '@lib/address';
import { RedisClientModule } from '@lib/redis-client'; // Import RedisClientModule


const resolvedPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../')
  : path.resolve(process.cwd(), 'apps/auth');
const resolvedEnvPath = `${resolvedPath}/.env`;
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolvedEnvPath, // Always resolves .env correctly
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // Use ConfigService to access JWT_SECRET
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PassportModule,
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Customer]),
    LoggerModule,
    AddressModule,
    RedisClientModule, // Add RedisClientModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    CustomerRepository,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor', // Use the exported interceptor
    },
  ],
})
export class AuthModule {}
