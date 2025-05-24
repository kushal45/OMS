import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entity/customer.entity';

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectRepository(Customer)
    private readonly custRepo: Repository<Customer>,
  ) {}

  async create(userData: Partial<Customer>): Promise<Customer> {
    const user = this.custRepo.create(userData);
    const savedUser = await this.custRepo.save(user);
    return savedUser;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return await this.custRepo.findOne({ where: { email } ,select:["id","name","email","password"]});
  }

  async update(id: number, updateData: Partial<Customer>):Promise<Customer | null> {
    console.log('updateData', updateData,"id",id);
    this.custRepo.update(id, updateData);
    const updatedUser = await this.custRepo.findOne({ where: { id } });
    return updatedUser ? updatedUser : null;
  }

  // Add more repository methods as needed
}