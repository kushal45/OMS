import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from './entity/inventory.entity';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve('apps/inventory/.env'), // Loads the .env file specific to this microservice
      isGlobal: true, // Makes the environment variables available globally
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Inventory]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService,InventoryRepository],
})
export class InventoryModule {}
