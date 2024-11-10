import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { Customer } from './entity/customer.entity';
import { JwtService } from '@nestjs/jwt';
import { LoginCustomerDto } from './dto/login-customer.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private tokenBlacklist: Set<string> = new Set();
  constructor(
    private readonly custRepository: CustomerRepository,
    private jwtService: JwtService,
  ) {}

  // Register customer
  async register(registerDto: RegisterCustomerDto): Promise<Customer> {
    const { name, email, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    return this.custRepository.create({
      name,
      email,
      password: hashedPassword,
    });
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
      accessToken: this.jwtService.sign(payload),
    };
  }

  // Update customer info
  async update(id: number, updateData: Partial<RegisterCustomerDto>) {
    return this.custRepository.update(id, updateData);
  }

  // Logout (Token invalidation can be implemented using blacklist or token expiration)
  logout(token: string): void {
    this.tokenBlacklist.add(token);
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  validateToken(token: string): boolean {
    return this.jwtService.verify(token).sub;
  }
}
