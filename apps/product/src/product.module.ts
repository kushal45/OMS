import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductRepository } from './repository/product.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';
import { Product } from './entity/product.entity';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/product/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Product]),
  ],
  controllers: [ProductController],
  providers: [ProductService,ProductRepository],
})
export class ProductModule {}
