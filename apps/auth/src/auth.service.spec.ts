import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer } from './entity/customer.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';

describe('AuthService', () => {
  let authService: AuthService;
  let customerRepository: CustomerRepository;
  let jwtService: JwtService;

  const mockCustomerRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CustomerRepository,
          useValue: mockCustomerRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    customerRepository = module.get<CustomerRepository>(CustomerRepository);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new customer with hashed password', async () => {
      const registerDto: RegisterCustomerDto = { name: 'John Doe', email: 'john@example.com', password: 'password' };
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const customer = { id: 1, name: registerDto.name, email: registerDto.email, password: hashedPassword };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(customerRepository, 'create').mockReturnValue(customer as any);

      const result = await authService.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(customerRepository.create).toHaveBeenCalledWith({
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
      });
      expect(result).toEqual(customer);
    });
  });

  describe('login', () => {
    it('should return an access token if credentials are valid', async () => {
      const loginDto: LoginCustomerDto = { email: 'john@example.com', password: 'password' };
      const customer = { id: 1, email: 'john@example.com', password: 'hashedPassword' };
      const token = 'access_token';

      jest.spyOn(customerRepository, 'findByEmail').mockResolvedValue(customer as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue(token);

      const result = await authService.login(loginDto);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, customer.password);
      expect(jwtService.sign).toHaveBeenCalledWith({ email: customer.email, id: customer.id });
      expect(result).toEqual({ access_token: token });
    });

    it('should throw an UnauthorizedException if email is invalid', async () => {
      const loginDto: LoginCustomerDto = { email: 'invalid@example.com', password: 'password' };

      jest.spyOn(customerRepository, 'findByEmail').mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an UnauthorizedException if password is invalid', async () => {
      const loginDto: LoginCustomerDto = { email: 'john@example.com', password: 'invalidPassword' };
      const customer = { id: 1, email: 'john@example.com', password: 'hashedPassword' };

      jest.spyOn(customerRepository, 'findByEmail').mockResolvedValue(customer as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(customerRepository.findByEmail).toHaveBeenCalledWith( loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, customer.password);
    });
  });
});