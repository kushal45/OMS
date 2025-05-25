import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AddressRepository } from './repository/address.repository';
import { CustomerAddressRepository } from './repository/customerAddress.respository';
import { Address } from './entity/address.entity';
import { TransactionService } from '@app/utils/transaction.service';
import { CustomerAddress } from './entity/customerAdress.entity';
import { LoggerService } from '@lib/logger/src';

@Injectable()
export class AddressService {
  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly customerAddressRepository: CustomerAddressRepository,
    private readonly transactionService: TransactionService,
    private readonly loggerService: LoggerService,
  ) {}

  async createAddress(
    address: Partial<Address>,
    userId: number,
  ): Promise<Partial<Address>> {
    const data = {
      address: address,
      userId: userId,
      message: 'Address beginning',
    };
    this.loggerService.debug(data, AddressService.name);
    let addressCreated: Address;
    await this.transactionService.executeInTransaction(
      async (entityManager) => {
        const custRepository =
          await this.customerAddressRepository.getRepository(entityManager);
        const addressRepository =
          await this.addressRepository.getRepository(entityManager);
        addressCreated = await addressRepository.create(address);
        console.log('addressCreated', addressCreated);
        await custRepository.create({
          userId,
          addressId: addressCreated.id,
        });
        return !!addressCreated;
      },
    );
    this.loggerService.debug(
      {
        address: addressCreated,
        userId: userId,
        message: 'Address created',
      },
      AddressService.name,
    );
    return addressCreated;
  }

  async fetchUserAddress(userId: number): Promise<CustomerAddress[]> {
    return this.customerAddressRepository.fetchUserAddresses(userId);
  }

  async update(addressId: number, address: Partial<Address>): Promise<Address> {
    return this.addressRepository.update(addressId, address);
  }

  async delete(userId: number, addressId: number): Promise<boolean> {
    try {
      let isAddressDeleted = false;
      await this.transactionService.executeInTransaction(
        async (entityManager) => {
          const custRepository =
            await this.customerAddressRepository.getRepository(entityManager);
          const addressRepository =
            await this.addressRepository.getRepository(entityManager);
          const isCustEntityDeleted = await custRepository.delete(
            addressId,
            userId,
          );
          isAddressDeleted = await addressRepository.delete(addressId);
          this.loggerService.debug(
            {
              userId: userId,
              addressId: addressId,
              message: 'Address delete',
              isCustEntityDeleted,
            },
            AddressService.name,
          );
          if (!isAddressDeleted) {
            throw new UnprocessableEntityException(
              'Address not deleted, please try again',
            );
          }
          return isAddressDeleted && isCustEntityDeleted;
        },
      );
      return isAddressDeleted;
    } catch (error) {
      throw error;
    }
  }

  async isValidAddress(userId: number, addressId: number): Promise<boolean> {
    return await this.customerAddressRepository.isValidAddress(
      userId,
      addressId,
    );
  }
}
