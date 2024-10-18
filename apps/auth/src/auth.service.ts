import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CustomerMapper } from './mapper/customer.mapper';
import { Customer } from './entity/customer.entity';
import { JwtService } from '@nestjs/jwt';
import { LoginCustomerDto } from './dto/login-customer.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private tokenBlacklist: Set<string> = new Set();
  constructor(private readonly custRepository: CustomerRepository, private jwtService: JwtService,) {}

   // Register customer
   async register(registerDto: RegisterCustomerDto): Promise<Customer> {
    const { name, email, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = this.custRepository.create({ name, email, password: hashedPassword });

    return 
  }

 // Customer login
 async login(loginDto: LoginCustomerDto) {
  const { email, password } = loginDto;
  const customer = await this.custRepository.findByEmail(email);

  if (!customer || !(await bcrypt.compare(password, customer.password))) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const payload = { email: customer.email, sub: customer.id };
  return {
    access_token: this.jwtService.sign(payload),
  };
}

// Update customer info
async updateCustomer(id: number, updateData: Partial<RegisterCustomerDto>) {
  return this.custRepository.update(id, updateData);
}

// Logout (Token invalidation can be implemented using blacklist or token expiration)
async logout(token: string): Promise<{ message: string }> {
  this.tokenBlacklist.add(token);
  return { message: 'Logout successful' };
}

isTokenBlacklisted(token: string): boolean {
  return this.tokenBlacklist.has(token);
}
}
