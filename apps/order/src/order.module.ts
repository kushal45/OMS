import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { OrderRepository } from './repository/order.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { AddressModule, AddressService } from '@lib/address/src';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerModule } from '@lib/logger/src';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';
import { OrderItems } from './entity/orderItems.entity';
import { Order } from './entity/order.entity';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/order/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    AddressModule,
    LoggerModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderItemsRepository,
    OrderRepository,
    TransactionService,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor', // Use the exported interceptor
    },
  ],
})
export class OrderModule {}
