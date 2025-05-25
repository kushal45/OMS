import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { LoggerModule } from '@lib/logger/src';
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
            package: 'INVENTORY_PACKAGE',
            protoPath: path.resolve('apps/inventory/src/proto/inventory.proto'),
            url: configService.get<string>('INVENTORY_SERVICE_URL', 'inventory:5002'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    LoggerModule,
    TypeOrmModule.forFeature([Cart, CartItem]),
    ElasticsearchModule.registerAsync({ // Add if needed later
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
        auth: {
          username: configService.get<string>('ELASTICSEARCH_USERNAME', 'elastic'),
          password: configService.get<string>('ELASTICSEARCH_PASSWORD', 'changeme'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CartController],
  providers: [
    CartService,
    CartRepository,
    CartItemRepository,
    TransactionService,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor',
    },
    {
      provide: 'KafkaProducerInstance',
      inject: [ModuleRef, ConfigService],
      useFactory: (
        moduleRef: ModuleRef,
        configService: ConfigService,
      ) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS', 'kafka:9092').split(','),
        };
        return new KafkaProducer(kafkaConfig, moduleRef);
      },
    },
    {
      provide: 'KafkaAdminInstance',
      inject: [ModuleRef, ConfigService],
      useFactory: (moduleRef: ModuleRef, configService: ConfigService) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS', 'kafka:9092').split(','),
        };
        return new KafkaAdminClient(kafkaConfig, moduleRef);
      },
    },
  ],
})
export class CartModule {}