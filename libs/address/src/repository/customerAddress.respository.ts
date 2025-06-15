import { EntityManager, FindOptionsSelect, Repository } from 'typeorm';
import { CustomerAddress } from '../entity/customerAdress.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { LoggerService } from '@lib/logger/src';

export class CustomerAddressRepository {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly custAddressRepo: Repository<CustomerAddress>,
    private moduleRef:ModuleRef) {}

    async findOne({addressId,userId}:{addressId:number,userId:number},selectOption: (keyof Partial<CustomerAddress>)[]=["addressId"]): Promise<CustomerAddress> {
      // const selectCriteria: FindOptionsSelect<CustomerAddress> = selectOption.reduce((acc, key) => {
      //   acc[key] = true;
      //   return acc;
      // }, {} as FindOptionsSelect<CustomerAddress>);
      return await this.custAddressRepo.findOne({
        where: { 
          userId,
          addressId
         },
      });
    }
  async create(addressObj: Partial<CustomerAddress>): Promise<CustomerAddress> {
    const newAddress = this.custAddressRepo.create(addressObj);
    return this.custAddressRepo.save(newAddress);
  }

  async findAll(): Promise<CustomerAddress[]> {
    return this.custAddressRepo.find();
  }

  async fetchUserAddresses(userId: number): Promise<CustomerAddress[]> {
    return this.custAddressRepo.find({
      where: { userId },
      relations: ['address'],
    });
  }

  async delete(addressId: number,userId:number): Promise<boolean> {
    const result = await this.custAddressRepo.delete({ addressId,userId });
    console.log('result', result);
    return result.affected > 0;
  }

  async isValidAddress(userId:number,addressId:number): Promise<boolean> {
    const loggerService = await this.moduleRef.resolve(LoggerService);
    loggerService.info(`Checking if address is valid for user ${userId} and addressId ${addressId}`,CustomerAddressRepository.name);
    const address = await this.findOne({ addressId,userId });
    return !!address;
  }
  getRepository(
    entityManager: EntityManager,
  ): CustomerAddressRepository {
    return new CustomerAddressRepository(entityManager.getRepository(CustomerAddress),this.moduleRef);
  }
}
