import { Injectable } from '@nestjs/common';
import { AddressRepository } from './repository/address.repository';
import { CustomerAddressRepository } from './repository/customerAddress.respository';
import { Address } from './entity/address.entity';
import { TransactionService } from '@app/utils/transaction.service';
import { CustomerAddress } from './entity/customerAdress.entity';
import { CustomLoggerService } from '@lib/logger/src';

@Injectable()
export class AddressService {
    constructor(private readonly addressRepository: AddressRepository,
        private readonly customerAddressRepository: CustomerAddressRepository,
    private readonly transactionService: TransactionService,
    private readonly loggerService: CustomLoggerService) {}
    
    async createAddress(address: Partial<Address>,userId:number): Promise<Partial<Address>> {
        const data ={
            address:address,
            userId:userId,
            message:'Address beginning'
        }
        this.loggerService.info(data,AddressService.name);
        let addressCreated: Address;
        await this.transactionService.executeInTransaction(async (entityManager) => {
            const custRepository = await this.customerAddressRepository.getRepository(entityManager);
            const addressRepository = await this.addressRepository.getRepository(entityManager);
            addressCreated= await addressRepository.create(address);
            console.log('addressCreated',addressCreated);
            await custRepository.create({
                userId,
                addressId:addressCreated.id
            });
       });
        this.loggerService.info({
            address:addressCreated,
            userId:userId,
            message:'Address created'
        },AddressService.name);
       return addressCreated;
    }

    async fetchUserAddress(userId:number): Promise<CustomerAddress[]> {
        return this.customerAddressRepository.fetchUserAddresses(userId);
    }
}
