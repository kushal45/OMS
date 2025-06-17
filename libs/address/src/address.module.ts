import { forwardRef, Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { TransactionService } from '@app/utils/transaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';
import { CustomerAddressRepository } from './repository/customerAddress.respository';
import { AddressRepository } from './repository/address.repository';
import { LoggerModule } from '@lib/logger/src';
import { Address } from './entity/address.entity';
import { CustomerAddress } from './entity/customerAdress.entity';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@lib/logger/src/logger.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Address, CustomerAddress]),
    LoggerModule,
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
      }),
      inject: [ConfigService],
    })
  ],
  providers: [
    AddressService,
    TransactionService,
    CustomerAddressRepository,
    AddressRepository,
    LoggerService,
  ],
  exports: [AddressService, LoggerService],
})
export class AddressModule {}
