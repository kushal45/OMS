import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { LoggerModule, LoggerService } from '@lib/logger/src';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { TransactionService } from '@app/utils/transaction.service';
import { Cart } from './entity/cart.entity';
import { CartItem } from './entity/cart-item.entity';
import { CartRepository } from './repository/cart.repository';
import { CartItemRepository } from './repository/cart-item.repository';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { OutboxEvent } from './entity/outbox-event.entity';
import { OutboxWorkerService } from './outbox/outbox-worker.service';
import { OutboxAdminService } from './outbox/outbox-admin.service';
import { OutboxAdminController } from './outbox/outbox-admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/cart/.env'),
      isGlobal: true,
    }),
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'INVENTORY_PACKAGE', // Package name from inventory.proto
            protoPath: path.resolve('apps/inventory/src/proto/inventory.proto'),
            url: configService.get<string>('INVENTORY_SERVICE_URL', 'inventory:5002'),
          },
        }),
        inject: [ConfigService],
      },
      { // Added Product Service Client
        name: 'PRODUCT_PACKAGE', // Injection token for Product Service
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'product', // Package name from product.proto
            protoPath: path.resolve('apps/product/src/proto/product.proto'), // Path to the new product.proto
            url: configService.get<string>('PRODUCT_SERVICE_URL', 'product:5001'), // URL for Product service
          },
        }),
        inject: [ConfigService],
      },
    ]),
    LoggerModule,
    TypeOrmModule.forFeature([Cart, CartItem, OutboxEvent]),
    ElasticsearchModule.registerAsync({ // Add if needed later
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200')
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CartController, OutboxAdminController],
  providers: [
    CartService,
    CartRepository,
    CartItemRepository,
    TransactionService,
    OutboxWorkerService,
    OutboxAdminService,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor',
    },
    {
      provide: 'KafkaProducerInstance',
      inject: [ModuleRef, ConfigService, LoggerService],
      useFactory: (
        moduleRef: ModuleRef,
        configService: ConfigService,
        logger: LoggerService,
      ) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS', 'kafka:9092').split(','),
        };
        return new KafkaProducer(kafkaConfig, moduleRef, logger);
      },
    },
    {
      provide: 'KafkaAdminInstance',
      inject: [ModuleRef, ConfigService, LoggerService],
      useFactory: (moduleRef: ModuleRef, configService: ConfigService, logger: LoggerService) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS', 'kafka:9092').split(','),
        };
        return new KafkaAdminClient(kafkaConfig, moduleRef, logger);
      },
    },
  ],
})
export class CartModule {}