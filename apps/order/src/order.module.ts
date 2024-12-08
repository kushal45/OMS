import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { OrderRepository } from './repository/order.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { AddressModule, AddressService } from '@lib/address/src';
import { TransactionService } from '@app/utils/transaction.service';
import { CustomLoggerService, LoggerModule } from '@lib/logger/src';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItems } from './entity/orderItems.entity';
import { Order } from './entity/order.entity';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/order/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    AddressModule,
    LoggerModule,
    TypeOrmModule.forFeature([Order, OrderItems]),
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
    {
      provide:"KafkaProducerInstance",
      inject:[ConfigService,CustomLoggerService],
      useFactory:(configService:ConfigService,logger:CustomLoggerService) => {
        const kafkaConfig ={
          clientId: configService.get<string>('ORDER_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaProducer(kafkaConfig,logger);
      }
    }
  ],
})
export class OrderModule {}
