import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule } from '@nestjs/config';
import * as path from "path";
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';

@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: path.resolve("apps/auth/.env"),  // Loads the .env file specific to this microservice
    isGlobal: true,       // Makes the environment variables available globally
  }),
  TypeOrmModule.forRootAsync(typeOrmAsyncConfig)],
  controllers: [AuthController],
  providers: [AuthService],

})
export class AuthModule {}
