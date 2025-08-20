import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { LoggerModule, LoggerService } from '@lib/logger/src';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../config/typeorm.config';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { TransactionService } from '@app/utils/transaction.service';
import { Cart } from './entity/cart.entity';
import { CartItem } from './entity/cart-item.entity';
import { CartDataService } from './repository/cart-data.repository';
import { CartItemRepository } from './repository/cart-item.repository';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { OutboxEvent } from './entity/outbox-event.entity';
import { OutboxWorkerService } from './outbox/outbox-worker.service';
import { OutboxAdminService } from './outbox/outbox-admin.service';
import { OutboxAdminController } from './outbox/outbox-admin.controller';
import { ServiceLocator } from './service.locator';
import { SchemaRegistryModule, SCHEMA_REGISTRY_SERVICE_TOKEN } from '@lib/kafka/schema-registry.module';
import { ISchemaRegistryService } from '@lib/kafka/interfaces/schema-registry-service.interface';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.join(__dirname, '../.env'),
      isGlobal: true,
    }),
    SchemaRegistryModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) =>
        typeOrmAsyncConfig.useFactory(configService),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Cart, CartItem, OutboxEvent]),
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'INVENTORY_PACKAGE', // Package name from inventory.proto
                        protoPath: path.join(__dirname,"../../inventory/src/proto/inventory.proto"),
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
            protoPath: path.join(__dirname, '../../product/src/proto/product.proto'), // Path to the new product.proto
            url: configService.get<string>('PRODUCT_SERVICE_URL', 'product:5001'), // URL for Product service
          },
        }),
        inject: [ConfigService],
      },
    ]),
    LoggerModule,
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200');
        const nodes = nodeEnv.includes(',') ? nodeEnv.split(',').map(url => url.trim()) : nodeEnv;
        console.log('Elasticsearch nodes:', nodes);
        return { node: nodes };
      },
      inject: [ConfigService],
    })
  ],
  controllers: [CartController, OutboxAdminController],
  providers: [
    CartService,
    CartDataService,
    CartItemRepository,
    TransactionService,
    OutboxWorkerService,
    OutboxAdminService,
    ServiceLocator,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor',
    },
    {
      provide: 'KafkaProducerInstance',
      inject: [ModuleRef, ConfigService, LoggerService, SCHEMA_REGISTRY_SERVICE_TOKEN],
      useFactory: (
        moduleRef: ModuleRef,
        configService: ConfigService,
        logger: LoggerService,
        schemaRegistryService: ISchemaRegistryService,
      ) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        };
        return new KafkaProducer(kafkaConfig, moduleRef, logger, schemaRegistryService);
      },
    },
    {
      provide: 'KafkaAdminInstance',
      inject: [ModuleRef, ConfigService, LoggerService],
      useFactory: (moduleRef: ModuleRef, configService: ConfigService, logger: LoggerService) => {
        const kafkaConfig = {
          clientId: configService.get<string>('CART_CLIENT_ID', 'cart-service'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        };
        return new KafkaAdminClient(kafkaConfig, moduleRef, logger);
      },
    },
  ],
})
export class CartModule {} 