import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entity/inventory.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';
import { CustomLoggerService, LoggerModule } from '@lib/logger/src';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConfig } from 'kafkajs';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ModuleRef } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/inventory/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Inventory]),
    LoggerModule
  ],
  controllers: [InventoryController],
  providers: [InventoryService,InventoryRepository,ConfigService,
    {
      provide: KafkaAdminClient,
      inject: [ModuleRef,CustomLoggerService,ConfigService],
      useFactory: (moduleRef:ModuleRef) => {
        const configService = moduleRef.get(ConfigService, { strict: false });
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaAdminClient(kafkaConfig,moduleRef);
      },
    },
    CustomLoggerService,
    {
      provide: "KafkaConsumerInstance",
      inject: [ModuleRef,ConfigService,CustomLoggerService],
      useFactory: (moduleRef:ModuleRef) => {
        const configService = moduleRef.get(ConfigService, { strict: false });
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        return new KafkaConsumer(kafkaConfig,moduleRef);
      },
    }
  ],
})
export class InventoryModule {}
