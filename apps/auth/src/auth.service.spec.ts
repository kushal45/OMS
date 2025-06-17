import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { CustomerRepository } from './repository/customer.repository';
import { AddressService } from '@lib/address/src/address.service';
import { AddressRepository } from '@lib/address/src/repository/address.repository';
import { CustomerAddressRepository } from '@lib/address/src/repository/customerAddress.respository';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerService } from '@lib/logger/src';

import { Customer } from './entity/customer.entity';
import { Address } from '@lib/address/src/entity/address.entity';
import { CustomerAddress } from '@lib/address/src/entity/customerAdress.entity'; // Note: filename is customerAdress.entity.ts

// Centralized Test DB Utilities
import GlobalTestOrmConfigService from '@lib/test-utils/src/orm.config.test';
import { initializeDatabase } from '@lib/test-utils/src/test-db-setup.util';
import { UnauthorizedException } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto'; // Added import

// Mocks
const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let dataSource: DataSource;
  let customerRepository: CustomerRepository; // Using the custom repository
  let jwtService: JwtService;
  let addressService: AddressService;
  // Raw repositories for seeding/verification if needed outside custom repo methods
  let rawCustomerRepository: Repository<Customer>;
  let rawAddressRepository: Repository<Address>;
  let rawCustomerAddressRepository: Repository<CustomerAddress>;


  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: GlobalTestOrmConfigService,
          dataSourceFactory: async (options) => new DataSource(options),
        }),
        TypeOrmModule.forFeature([Customer, Address, CustomerAddress]),
        JwtModule.registerAsync({ // Basic JWT setup for testing
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET') || 'test-secret',
            signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h' },
          }),
          inject: [ConfigService],
        }),
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }), // Load .env for JWT settings if any
      ],
      providers: [
        AuthService,
        CustomerRepository, // Provide the custom repository
        AddressService,     // Real AddressService
        AddressRepository,  // Real AddressRepository (dependency of AddressService)
        CustomerAddressRepository, // Real CustomerAddressRepository (dependency of AddressService)
        TransactionService, // Real TransactionService (dependency of AddressService)
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    dataSource = module.get<DataSource>(DataSource);
    customerRepository = module.get<CustomerRepository>(CustomerRepository);
    jwtService = module.get<JwtService>(JwtService);
    addressService = module.get<AddressService>(AddressService);

    rawCustomerRepository = module.get<Repository<Customer>>(getRepositoryToken(Customer));
    rawAddressRepository = module.get<Repository<Address>>(getRepositoryToken(Address));
    rawCustomerAddressRepository = module.get<Repository<CustomerAddress>>(getRepositoryToken(CustomerAddress));
  });

  beforeEach(async () => {
    await initializeDatabase(dataSource);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new customer', async () => {
      const registerDto = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      // The service's register method is typed as Promise<RegisterCustomerResponseDto>
      // but its implementation `return this.custRepository.create(...) as unknown as RegisterCustomerResponseDto;`
      // likely returns a Customer-like object. The test reflects this current behavior.
      // Ideally, the service should construct the full RegisterCustomerResponseDto.
      const result: any = await service.register(registerDto); // Cast to any to bypass DTO type for now

      expect(result).toBeDefined();
      expect(result.email).toEqual(registerDto.email); // Assumes service returns Customer-like object
      expect(result.name).toEqual(registerDto.name);   // Assumes service returns Customer-like object
      // Password should be hashed, so we don't check it directly
      // Instead, verify the customer exists in the DB
      const dbCustomer = await rawCustomerRepository.findOneBy({ email: registerDto.email });
      expect(dbCustomer).toBeDefined();
      expect(dbCustomer.name).toEqual(registerDto.name);
      expect(await bcrypt.compare(registerDto.password, dbCustomer.password)).toBe(true);
    });

    it('should throw an error if email already exists (implicitly via DB constraint)', async () => {
      const registerDto = { name: 'Test User', email: 'duplicate@example.com', password: 'password123' };
      await service.register(registerDto); // Register first time

      // Attempt to register again with the same email
      // TypeORM should throw an error due to unique constraint on email
      // The exact error type might depend on the DB driver and TypeORM version.
      // Often it's a QueryFailedError.
      await expect(service.register({ ...registerDto, name: 'Another User' })).rejects.toThrow();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'login@example.com', password: 'password123' };
    let hashedPassword;

    beforeEach(async () => {
      hashedPassword = await bcrypt.hash(loginDto.password, 10);
      await rawCustomerRepository.save(
        rawCustomerRepository.create({
          name: 'Login User',
          email: loginDto.email,
          password: hashedPassword,
        }),
      );
    });

    it('should successfully login a customer with correct credentials', async () => {
      const result = await service.login('test-correlation-id', loginDto);
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      // Optionally, decode token and check payload
      const decoded = jwtService.decode(result.accessToken) as any;
      expect(decoded.email).toEqual(loginDto.email);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      await expect(
        service.login('test-correlation-id', { email: 'wrong@example.com', password: loginDto.password }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      await expect(
        service.login('test-correlation-id', { email: loginDto.email, password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createAddress', () => {
    let testCustomer: Customer;
    const createAddressDto: CreateAddressDto = {
      street: '123 Main St',
      city: 'Anytown',
      state: 'Anystate',
      country: 'Anycountry',
      pincode: '12345',
    };

    beforeEach(async () => {
      testCustomer = await rawCustomerRepository.save(
        rawCustomerRepository.create({
          name: 'Address User',
          email: 'addressuser@example.com',
          password: 'password',
        }),
      );
      // Mock the underlying AddressService.createAddress method
      jest.spyOn(addressService, 'createAddress').mockImplementation(async (addressInput, userIdInput) => {
        // Simulate what AddressService would return: a Partial<Address>
        return {
          id: 1, // AddressService returns numeric ID
          ...addressInput,
        };
      });
    });

    it('should call addressService.createAddress and return its result (currently casted)', async () => {
      // AuthService.createAddress currently returns what AddressService.createAddress returns,
      // cast to CreateAddrDataResponseDto. The test reflects this.
      // Ideally, AuthService should properly construct CreateAddrDataResponseDto.
      const result: any = await service.createAddress(testCustomer.id, createAddressDto);

      expect(addressService.createAddress).toHaveBeenCalledWith(createAddressDto, testCustomer.id);
      expect(result).toBeDefined();
      expect(result.id).toEqual(1); // AddressService returns numeric id
      expect(result.street).toEqual(createAddressDto.street);
      expect(result.city).toEqual(createAddressDto.city);
      // Note: The actual CreateAddrDataResponseDto expects id as string.
      // The service should handle this conversion.
    });

    it('should propagate errors from addressService.createAddress', async () => {
      const errorMessage = 'Address service failed';
      jest.spyOn(addressService, 'createAddress').mockRejectedValueOnce(new Error(errorMessage));

      await expect(service.createAddress(testCustomer.id, createAddressDto)).rejects.toThrow(errorMessage);
    });
  });

  describe('validateToken', () => {
    const userPayload = { id: 1, email: 'validate@example.com', name: 'Validate User' };
    let validToken: string;

    beforeEach(() => {
      validToken = jwtService.sign(userPayload);
    });

    it('should validate a correct token and return its payload', () => {
      const result = service.validateToken(validToken);
      expect(result.id).toEqual(userPayload.id);
      expect(result.email).toEqual(userPayload.email);
      expect(result.name).toEqual(userPayload.name);
    });

    it('should throw an error for an invalid token signature', () => {
      const invalidToken = validToken.slice(0, -5) + 'wrong'; // Tamper with the token
      expect(() => service.validateToken(invalidToken)).toThrow(); // JwtService throws JsonWebTokenError
    });

    it('should throw an error for an expired token', () => {
      const expiredToken = jwtService.sign(userPayload, { expiresIn: '0s' });
      // Need to wait a tiny bit for the token to actually expire
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(() => service.validateToken(expiredToken)).toThrow(); // JwtService throws TokenExpiredError
          resolve();
        }, 50);
      });
    });
  });

  describe('logout and isTokenBlacklisted', () => {
    it('should add a token to the blacklist on logout', () => {
      const tokenToBlacklist = 'some.jwt.token';
      service.logout(tokenToBlacklist);
      expect(service.isTokenBlacklisted(tokenToBlacklist)).toBe(true);
    });

    it('should return false for a token not on the blacklist', () => {
      expect(service.isTokenBlacklisted('another.jwt.token')).toBe(false);
    });
  });

  // TODO: Add tests for update customer
});
