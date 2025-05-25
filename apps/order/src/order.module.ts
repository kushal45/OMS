import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { OrderRepository } from './repository/order.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { AddressModule } from '@lib/address/src';
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
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/order/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    ClientsModule.register([
      {
        name: 'INVENTORY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'INVENTORY_PACKAGE',
          protoPath: path.resolve('apps/inventory/src/proto/inventory.proto'),
          url: `inventory:5002`,
        },
      },
    ]),
    AddressModule,
    LoggerModule, // Kept LoggerModule here
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
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderItemsRepository,
    OrderRepository,
    TransactionService,
    ServiceLocator,
    DefaultOrderConfigService, // Add DefaultOrderConfigService to providers
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor', // Use the exported interceptor
    },
    {
      provide: 'KafkaProducerInstance',
      inject: [ModuleRef, ConfigService, LoggerService],
      useFactory: (
        moduleRef: ModuleRef,
        configService: ConfigService,
        logger: LoggerService, // Inject LoggerService
      ) => {
        const kafkaConfig = {
          clientId: configService.get<string>('ORDER_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        };
        return new KafkaProducer(kafkaConfig, moduleRef, logger); // Pass loggerService
      },
    },
    {
      provide: 'KafkaAdminInstance',
      inject: [ModuleRef, ConfigService, LoggerService], // Add LoggerService to inject
      useFactory: (moduleRef: ModuleRef, configService: ConfigService, loggerService: LoggerService) => { // Add loggerService to factory params
        const kafkaConfig = {
          clientId: configService.get<string>('ORDER_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        };
        return new KafkaAdminClient(kafkaConfig, moduleRef, loggerService); // Pass loggerService
      },
    },
  ],
})
export class OrderModule {}
