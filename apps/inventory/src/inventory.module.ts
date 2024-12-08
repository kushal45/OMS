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
      
      useFactory: (logger: CustomLoggerService,configService:ConfigService) => {
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        logger.info({
          message: 'Creating KafkaAdminClient',
          kafkaConfig,
        },'KafkAdminClientProvider');
        return new KafkaAdminClient(kafkaConfig, logger);
      },
      inject: [CustomLoggerService,ConfigService],
    },
    CustomLoggerService,
    {
      provide: KafkaConsumer,
      inject: [ConfigService,CustomLoggerService],
      useFactory: (configService: ConfigService,logger:CustomLoggerService) => {
        console.log("configService",configService);
        const kafkaConfig: KafkaConfig ={
          clientId: configService.get<string>('INVENTORY_CLIENT_ID'),
          brokers: configService.get<string>('KAFKA_BROKERS').split(','),
        }
        logger.info({
          message: 'Creating KafkaConsumer',
          kafkaConfig,
        },'KafkaConsumerProvider');
        return new KafkaConsumer(kafkaConfig, logger,configService.get<string>('INVENTORY_CONSUMER_GROUP_ID'));
      },
    }
  ],
})
export class InventoryModule {}
