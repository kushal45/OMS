import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CustomerRepository } from './repository/customer.repository';
import { JwtService } from '@nestjs/jwt';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { LoggerService } from '@lib/logger/src/logger.service';
import { AddressService } from '@lib/address/src';

describe('AuthService', () => {
  let authService: AuthService;
  let customerRepository: CustomerRepository;
  let jwtService: JwtService;
  let loggerService: LoggerService;
  let addressService: AddressService;

  const mockCustomerRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockLoggerService = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockAddressService = {
    createAddress: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
          useValue: mockJwtService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: AddressService,
          useValue: mockAddressService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    customerRepository = module.get<CustomerRepository>(CustomerRepository);
    jwtService = module.get<JwtService>(JwtService);
    loggerService = module.get<LoggerService>(LoggerService);
    addressService = module.get<AddressService>(AddressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new customer with hashed password', async () => {
      const registerDto: RegisterCustomerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password',
      };
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const customer = {
        id: 1,
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
      };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      mockCustomerRepository.create.mockReturnValue(customer);

      const result = await authService.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(customerRepository.create).toHaveBeenCalledWith({
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
      });
      expect(result).toEqual(customer);
    });

    it('should handle errors during registration', async () => {
      const registerDto: RegisterCustomerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password',
      };

      jest.spyOn(bcrypt, 'hash').mockImplementation(() => {
        throw new Error('Hashing failed');
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        'Hashing failed',
      );
    });
  });

  describe('login', () => {
    const correlationId = 'test-correlation-id';

    it('should return an access token if credentials are valid', async () => {
      const loginDto: LoginCustomerDto = {
        email: 'john@example.com',
        password: 'password',
      };
      const customer = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword',
      };
      const token = 'access_token';

      mockCustomerRepository.findByEmail.mockResolvedValue(customer);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue(token);

      const result = await authService.login(correlationId, loginDto);

      expect(customerRepository.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        customer.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: customer.email,
        id: customer.id,
        name: customer.name,
      });
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User logged in successfully',
          email: customer.email,
          correlationId,
        }),
        'AuthService',
      );
      expect(result).toEqual({ accessToken: token });
    });

    it('should throw an UnauthorizedException if email is invalid', async () => {
      const loginDto: LoginCustomerDto = {
        email: 'invalid@example.com',
        password: 'password',
      };

      mockCustomerRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(correlationId, loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(customerRepository.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    it('should throw an UnauthorizedException if password is invalid', async () => {
      const loginDto: LoginCustomerDto = {
        email: 'john@example.com',
        password: 'invalidPassword',
      };
      const customer = {
        id: 1,
        email: 'john@example.com',
        password: 'hashedPassword',
      };

      mockCustomerRepository.findByEmail.mockResolvedValue(customer);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(authService.login(correlationId, loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(customerRepository.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        customer.password,
      );
      expect(loggerService.info).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update customer information', async () => {
      const userId = 1;
      const updateData: UpdateCustomerDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phoneNumber: '1234567890',
        countryCode: '+91',
      };
      const updatedCustomer = {
        id: userId,
        name: 'Updated Name',
        email: 'john@example.com',
      };

      mockCustomerRepository.update.mockResolvedValue(updatedCustomer);

      const result = await authService.update(userId, updateData);

      expect(customerRepository.update).toHaveBeenCalledWith(
        userId,
        updateData,
      );
      expect(result).toEqual(updatedCustomer);
    });

    it('should handle errors during update', async () => {
      const userId = 1;
      const updateData: UpdateCustomerDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phoneNumber: '1234567890',
        countryCode: '+91',
      };

      mockCustomerRepository.update.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(authService.update(userId, updateData)).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('logout', () => {
    it('should add token to blacklist', () => {
      const token = 'valid_token';

      authService.logout(token);

      expect(authService.isTokenBlacklisted(token)).toBe(true);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted tokens', () => {
      const token = 'blacklisted_token';

      authService.logout(token);

      expect(authService.isTokenBlacklisted(token)).toBe(true);
    });

    it('should return false for non-blacklisted tokens', () => {
      const token = 'valid_token';

      expect(authService.isTokenBlacklisted(token)).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should return payload for valid token', () => {
      const token = 'valid_token';
      const payload = { id: 1, email: 'john@example.com', name: 'John Doe' };

      process.env.JWT_SECRET = 'test_secret';
      mockJwtService.verify.mockReturnValue(payload);

      const result = authService.validateToken(token);

      expect(jwtService.verify).toHaveBeenCalledWith(token, {
        secret: process.env.JWT_SECRET,
      });
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid_token';

      process.env.JWT_SECRET = 'test_secret';
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.validateToken(token)).toThrow('Invalid token');
    });
  });

  describe('createAddress', () => {
    it('should create address for user', async () => {
      const userId = 1;
      const addressDto: CreateAddressDto = {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        pincode: '10001',
        country: 'USA',
      };
      const createdAddress = { id: 1, ...addressDto, userId };

      mockAddressService.createAddress.mockResolvedValue(createdAddress);

      const result = await authService.createAddress(userId, addressDto);

      expect(addressService.createAddress).toHaveBeenCalledWith(
        addressDto,
        userId,
      );
      expect(result).toEqual(createdAddress);
    });

    it('should handle errors during address creation', async () => {
      const userId = 1;
      const addressDto: CreateAddressDto = {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        pincode: '10001',
        country: 'USA',
      };

      mockAddressService.createAddress.mockRejectedValue(
        new Error('Address creation failed'),
      );

      await expect(
        authService.createAddress(userId, addressDto),
      ).rejects.toThrow('Address creation failed');
    });
  });

  describe('updateAddress', () => {
    it('should update address for user', async () => {
      const userId = 1;
      const addressId = 1;
      const addressDto: CreateAddressDto = {
        street: '456 Updated St',
        city: 'Updated City',
        state: 'UC',
        pincode: '20002',
        country: 'USA',
      };
      const updatedAddress = { id: addressId, ...addressDto, userId };

      mockAddressService.update.mockResolvedValue(updatedAddress);

      const result = await authService.updateAddress(
        userId,
        addressId,
        addressDto,
      );

      expect(addressService.update).toHaveBeenCalledWith(addressId, addressDto);
      expect(result).toEqual(updatedAddress);
    });

    it('should handle errors during address update', async () => {
      const userId = 1;
      const addressId = 1;
      const addressDto: CreateAddressDto = {
        street: '456 Updated St',
        city: 'Updated City',
        state: 'UC',
        pincode: '20002',
        country: 'USA',
      };

      mockAddressService.update.mockRejectedValue(
        new Error('Address update failed'),
      );

      await expect(
        authService.updateAddress(userId, addressId, addressDto),
      ).rejects.toThrow('Address update failed');
    });
  });

  describe('deleteAddress', () => {
    it('should delete address for user', async () => {
      const userId = 1;
      const addressId = 1;

      mockAddressService.delete.mockResolvedValue(true);

      const result = await authService.deleteAddress(userId, addressId);

      expect(addressService.delete).toHaveBeenCalledWith(userId, addressId);
      expect(result).toBe(true);
    });

    it('should handle errors during address deletion', async () => {
      const userId = 1;
      const addressId = 1;

      mockAddressService.delete.mockRejectedValue(
        new Error('Address deletion failed'),
      );

      await expect(
        authService.deleteAddress(userId, addressId),
      ).rejects.toThrow('Address deletion failed');
    });

    it('should return false if address deletion fails', async () => {
      const userId = 1;
      const addressId = 1;

      mockAddressService.delete.mockResolvedValue(false);

      const result = await authService.deleteAddress(userId, addressId);

      expect(addressService.delete).toHaveBeenCalledWith(userId, addressId);
      expect(result).toBe(false);
    });
  });
});
