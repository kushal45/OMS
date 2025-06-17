import { Module, Res } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entity/inventory.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';
import { LoggerModule, LoggerService } from '@lib/logger/src'; // Import LoggerService
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConfig } from 'kafkajs';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { TransactionService } from '@app/utils/transaction.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { InventoryKafkaMetricsService } from './monitoring/inventory-kafka-metrics.service';
import { InventoryMonitoringController } from './monitoring/inventory-monitoring.controller';
import { ReserveInventoryHandler } from './kafka-handlers/reserve-inventory.handler';
import { ReleaseInventoryHandler } from './kafka-handlers/release-inventory.handler';
import { ReplenishInventoryHandler } from './kafka-handlers/replenish-inventory.handler'; // Import the new handler

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/inventory/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Inventory]),
    LoggerModule,
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
    
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [InventoryController, InventoryMonitoringController],
  providers: [
    InventoryService,
    InventoryRepository,
    InventoryKafkaMetricsService,
    ReserveInventoryHandler, // Ensure this handler is also provided
    ReleaseInventoryHandler, // Register the new handler
    ReplenishInventoryHandler, // Provide the new handler
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor', // Use the exported interceptor
    },
    {
      provide: KafkaAdminClient,
      inject: [ConfigService, LoggerService, ModuleRef], // Inject ConfigService, LoggerService, and ModuleRef
      useFactory: (configService: ConfigService, loggerService: LoggerService, moduleRef: ModuleRef) => { // Correct factory signature
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaAdminClient(kafkaConfig, moduleRef, loggerService); // Pass loggerService
      },
    },
    {
      provide: "KafkaConsumerInstance",
      inject: [ConfigService, LoggerService, ModuleRef], // Inject ConfigService, LoggerService, and ModuleRef
      useFactory: (configService: ConfigService, loggerService: LoggerService, moduleRef: ModuleRef) => { // Correct factory signature
        const kafkaConfig: KafkaConfig = {
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        };
        return new KafkaConsumer(kafkaConfig, moduleRef, loggerService); // Pass loggerService
      },
    },
    TransactionService,
  ],
})
export class InventoryModule {}
