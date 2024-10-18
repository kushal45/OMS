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
    return await this.custRepo.save(user);
  }

  async findById(id: number): Promise<Customer | null> {
    return await this.custRepo.findOne({ where: { id } });
  }

  // Add more repository methods as needed
}