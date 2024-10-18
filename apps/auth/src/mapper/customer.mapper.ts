import { RegisterCustomerDto  } from '../dto/register-customer.dto';
import { Customer } from '../entity/customer.entity'
export class CustomerMapper {
  static create(dto: RegisterCustomerDto ): Partial<Customer> {
    return {
      name: dto.name,
      email: dto.email,
      password: dto.password,
    };
  }
}