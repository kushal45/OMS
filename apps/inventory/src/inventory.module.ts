import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entity/inventory.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';
import { LoggerService, LoggerModule } from '@lib/logger/src';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConfig } from 'kafkajs';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { TransactionService } from '@app/utils/transaction.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

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
  controllers: [InventoryController],
  providers: [InventoryService,InventoryRepository,ConfigService,
    {
      provide: APP_INTERCEPTOR,
      useExisting: 'LoggerErrorInterceptor', // Use the exported interceptor
    },
    {
      provide: KafkaAdminClient,
      inject: [ModuleRef,LoggerService,ConfigService],
      useFactory: (moduleRef:ModuleRef) => {
        const configService = moduleRef.get(ConfigService, { strict: false });
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaAdminClient(kafkaConfig,moduleRef);
      },
    },
    LoggerService,
    {
      provide: "KafkaConsumerInstance",
      inject: [ModuleRef,ConfigService,LoggerService],
      useFactory: (moduleRef:ModuleRef) => {
        const configService = moduleRef.get(ConfigService, { strict: false });
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaConsumer(kafkaConfig,moduleRef);
      },
    },
    TransactionService,
  ],
})
export class InventoryModule {}
