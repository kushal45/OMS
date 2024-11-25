import { EntityManager, Repository } from 'typeorm';
import { Address } from '../entity/address.entity';
import { InjectRepository } from '@nestjs/typeorm';


export class AddressRepository {
  
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>) {}

  async findOne(id: number): Promise<Address> {
    return await this.addressRepo.findOne({
      where: { id },
    });
  }

  async create(address: Partial<Address>): Promise<Address> {
    const newAddress = this.addressRepo.create(address);
    return this.addressRepo.save(newAddress);
  }

  async update(id: number, address: Partial<Address>): Promise<Address> {
    await this.addressRepo.update(id, address);
    return await this.findOne(id);
  }

  async findAll(): Promise<Address[]> {
    return this.addressRepo.find();
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.addressRepo.delete(id);
    return result.affected > 0;
  }

   getRepository(entityManager: EntityManager) :AddressRepository {
    return new AddressRepository(entityManager.getRepository(Address));
  }
}