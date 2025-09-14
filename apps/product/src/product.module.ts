import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductRepository } from './repository/product.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';
import { Product } from './entity/product.entity';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { LoggerModule } from '@lib/logger/src'; // Added LoggerModule
import { RedisClientModule } from '@lib/redis-client'; // Import RedisClientModule


const resolvedPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../')
  : path.resolve(process.cwd(), 'apps/order');
const resolvedEnvPath = `${resolvedPath}/.env`;
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath:resolvedEnvPath,
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Product]),
    LoggerModule, // Added LoggerModule to imports
    RedisClientModule, // Add RedisClientModule
  ],
  controllers: [ProductController],
  providers: [ProductService,ProductRepository], // LoggerService is typically provided by LoggerModule
})
export class ProductModule {}
