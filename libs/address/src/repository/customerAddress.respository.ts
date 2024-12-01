import { EntityManager, FindOptionsSelect, Repository } from 'typeorm';
import { CustomerAddress } from '../entity/customerAdress.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { console } from 'inspector';

export class CustomerAddressRepository {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly custAddressRepo: Repository<CustomerAddress>) {}

    async findOne({addressId,userId}:{addressId:number,userId:number},selectOption: (keyof Partial<CustomerAddress>)[]=["addressId"]): Promise<CustomerAddress> {
      const selectCriteria: FindOptionsSelect<CustomerAddress> = selectOption.reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {} as FindOptionsSelect<CustomerAddress>);
      return await this.custAddressRepo.findOne({
        where: { 
          userId,
          addressId
         },
        select: selectCriteria
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
    const address = await this.findOne({ addressId,userId });
    return !!address;
  }
  getRepository(
    entityManager: EntityManager,
  ): CustomerAddressRepository {
    return new CustomerAddressRepository(entityManager.getRepository(CustomerAddress));
  }
}
