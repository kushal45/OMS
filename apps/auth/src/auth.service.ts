import { Injectable } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CustomerMapper } from './mapper/customer.mapper';
import { Customer } from './entity/customer.entity';

@Injectable()
export class AuthService {
  constructor(private readonly custRepository: CustomerRepository) {}

  async registerCustomer(custData: RegisterCustomerDto): Promise<Customer> {
    const custEntity=CustomerMapper.create(custData);
    return await this.custRepository.create(custEntity);
  }
}
