import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { OrderRepository } from './repository/order.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { AddressModule } from '@lib/address';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerModule, LoggerService } from '@lib/logger/src'; // Removed LoggerService from here
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItems } from './entity/orderItems.entity';
import { Order } from './entity/order.entity';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceLocator } from './service-locator';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { DefaultOrderConfigService } from './util/orderConfig.service'; // Import DefaultOrderConfigService
import { SchemaRegistryModule, SCHEMA_REGISTRY_SERVICE_TOKEN } from '@lib/kafka/schema-registry.module';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ISchemaRegistryService } from '@lib/kafka/interfaces/schema-registry-service.interface';
import { SentryModule } from '@lib/sentry';
import { NotificationsModule } from '@lib/notifications';
import { SentryWebhookController } from './webhooks/sentry-webhook.controller';


const resolvedPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../')
  : path.resolve(process.cwd(), 'apps/order');
const resolvedEnvPath = `${resolvedPath}/.env`;
console.log("resolvedPath",resolvedEnvPath);
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolvedEnvPath,
      isGlobal: true,
    }),
    SchemaRegistryModule,
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'INVENTORY_PACKAGE', // Matches package in inventory.proto
            protoPath: path.join(resolvedEnvPath, "../../inventory/src/proto/inventory.proto"),
            url: configService.get<string>('INVENTORY_SERVICE_GRPC_URL', 'inventory:5002'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'CART_PACKAGE',
        imports: [ConfigModule], // Import ConfigModule to use ConfigService
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'cart', // Matches package in cart.proto
            protoPath: path.join(resolvedPath, "../cart/src/proto/cart.proto"),
            url: configService.get<string>('CART_SERVICE_GRPC_URL', 'cart:5005'), // Use env var, default to 5005
          },
        }),
        inject: [ConfigService], // Inject ConfigService
      },
    ]),
    AddressModule,
    LoggerModule, // Kept LoggerModule here
    SentryModule, // Add Sentry module for alerting
    NotificationsModule, // Add Notifications module for email
    TypeOrmModule.forFeature([Order, OrderItems]),
    ElasticsearchModule.registerAsync({
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
  controllers: [OrderController, SentryWebhookController],
  providers: [
    OrderService,
    OrderItemsRepository,
    OrderRepository,
    TransactionService,
    ServiceLocator,
    DefaultOrderConfigService, // Add DefaultOrderConfigService to providers
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
        logger: LoggerService, // Inject LoggerService
        schemaRegistryService: ISchemaRegistryService,
      ) => {
        const kafkaConfig = {
          clientId: configService.get<string>('ORDER_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
          retry: { // Add retry configuration
            initialRetryTime: 300,
            retries: 8,
            maxRetryTime: 30000,
            multiplier: 2,
            factor: 0.2,
          },
        };
        return new KafkaProducer(kafkaConfig, moduleRef, logger, schemaRegistryService);
      },
    },
    {
      provide: 'KafkaAdminInstance',
      inject: [ModuleRef, ConfigService, LoggerService], // Add LoggerService to inject
      useFactory: (moduleRef: ModuleRef, configService: ConfigService, loggerService: LoggerService) => { // Add loggerService to factory params
        const kafkaConfig = {
          clientId: configService.get<string>('ORDER_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
          retry: { // Add retry configuration for consistency
            initialRetryTime: 300,
            retries: 8,
            maxRetryTime: 30000,
            multiplier: 2,
            factor: 0.2,
          },
        };
        return new KafkaAdminClient(kafkaConfig, moduleRef, loggerService); // Pass loggerService
      },
    },
  ],
})
export class OrderModule {}
