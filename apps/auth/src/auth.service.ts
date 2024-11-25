import {  Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginCustomerDto } from './dto/login-customer.dto';
import * as bcrypt from 'bcryptjs';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RegisterCustomerResponseDto } from './dto/register-customer-response.dto';
import { ValidateTokenResponseDto } from './dto/validate-token-response.dto';
import { CustomLoggerService } from '@lib/logger/src/logger.service';
import { AddressService } from '@lib/address/src';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateAddrDataResponseDto } from './dto/create-addr-response.dto';

@Injectable()
export class AuthService {
  private tokenBlacklist: Set<string> = new Set();
  private context = AuthService.name;
  constructor(
    private readonly custRepository: CustomerRepository,
    private jwtService: JwtService,
    private logger: CustomLoggerService,
    private addressService:AddressService
  ) {}

  // Register customer
  async register(
    registerDto: RegisterCustomerDto,
  ): Promise<RegisterCustomerResponseDto> {
    const { name, email, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    return this.custRepository.create({
      name,
      email,
      password: hashedPassword,
    }) as unknown as RegisterCustomerResponseDto;
  }

  // Customer login
  async login(
    correlationId: string,
    loginDto: LoginCustomerDto,
  ): Promise<{ accessToken: string }> {
    const { email, password } = loginDto;
    const customer = await this.custRepository.findByEmail(email);

    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    this.logger.info(
      {
        message: 'User logged in successfully',
        email: customer.email,
        correlationId
      },
      this.context
    );

    const payload = {
      email: customer.email,
      sub: customer.id,
      name: customer.name,
    };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  // Update customer info
  async update(id: number, updateData: Partial<UpdateCustomerDto>) {
    return this.custRepository.update(id, updateData);
  }

  // Logout (Token invalidation can be implemented using blacklist or token expiration)
  logout(token: string): void {
    this.tokenBlacklist.add(token);
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  validateToken(token: string): ValidateTokenResponseDto {
    const payload = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET,
    });
    //console.log("Payload is:: ->",payload);
    return payload as ValidateTokenResponseDto;
  }

  async createAddress(userId:number,address:CreateAddressDto):Promise<CreateAddrDataResponseDto>{
    return await this.addressService.createAddress(address,userId) as unknown as CreateAddrDataResponseDto;
  }

  async updateAddress(userId:number,addressId:number,address:CreateAddressDto):Promise<CreateAddrDataResponseDto>{
    return await this.addressService.update(addressId,address) as unknown as CreateAddrDataResponseDto;
  }

  async deleteAddress(userId:number,addressId:number):Promise<boolean>{
    try {
      return await this.addressService.delete(userId,addressId);
    } catch (error) {
       throw error;
    }
   
  }
}
