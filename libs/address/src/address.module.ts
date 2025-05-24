import { forwardRef, Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { TransactionService } from '@app/utils/transaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../../../apps/config/typeorm.config';
import { CustomerAddressRepository } from './repository/customerAddress.respository';
import { AddressRepository } from './repository/address.repository';
import { LoggerService, LoggerModule } from '@lib/logger/src';
import { Address } from './entity/address.entity';
import { CustomerAddress } from './entity/customerAdress.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TypeOrmModule.forFeature([Address, CustomerAddress]),
    forwardRef(() => LoggerModule),
  ],
  providers: [
    AddressService,
    TransactionService,
    CustomerAddressRepository,
    AddressRepository,
  ],
  exports: [AddressService],
})
export class AddressModule {}
