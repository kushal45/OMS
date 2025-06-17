import { EntityManager, FindOptionsSelect, Repository } from 'typeorm';
import { Address } from '../entity/address.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from '@app/order/src/util/interfaces/base-repository.interface';


export class AddressRepository  implements BaseRepository<AddressRepository> {
  
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>) {}

  async findOne(id: number, selectOption: (keyof Partial<Address>)[]=["id"]): Promise<Address> {
    const selectCriteria: FindOptionsSelect<Address> = selectOption.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as FindOptionsSelect<Address>);
    return await this.addressRepo.findOne({
      where: { id },
      select: selectCriteria
    });
  }

  async findByAttributes(attributes: Partial<Address>, selectOption: (keyof Partial<Address>)[]=["id"]): Promise<Address[]> {
    const selectCriteria: FindOptionsSelect<Address> = selectOption.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as FindOptionsSelect<Address>);
    return await this.addressRepo.find({
      where: attributes,
      select: selectCriteria
    });
  }

  async create(address: Partial<Address>): Promise<Address> {
    const newAddress = this.addressRepo.create(address);
    return this.addressRepo.save(newAddress);
  }

  async update(id: number, address: Partial<Address>): Promise<Address> {
    await this.addressRepo.update(id, address);
    return await this.findOne(id,['id','street','city','state','country','pincode']);
  }

  async findAll(): Promise<Address[]> {
    return this.addressRepo.find();
  }

  async validateAddress(id: number): Promise<boolean> {
    const address = await this.findOne(id);
    return !!address;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.addressRepo.delete(id);
    console.log("address delete result",result);
    return result.affected > 0;
  }

   getRepository(entityManager: EntityManager) :AddressRepository {
    return new AddressRepository(entityManager.getRepository(Address));
  }
}