import { EntityManager, Repository } from 'typeorm';
import { CustomerAddress } from '../entity/customerAdress.entity';
import { InjectRepository } from '@nestjs/typeorm';

export class CustomerAddressRepository {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly custAddressRepo: Repository<CustomerAddress>) {}

  async findOne(id: number): Promise<CustomerAddress> {
    return await this.custAddressRepo.findOne({
      where: { addressId: id },
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

  async delete(addressId: number): Promise<boolean> {
    const result = await this.custAddressRepo.delete(addressId);
    return result.affected > 0;
  }

  getRepository(
    entityManager: EntityManager,
  ): CustomerAddressRepository {
    return new CustomerAddressRepository(entityManager.getRepository(CustomerAddress));
  }
}
