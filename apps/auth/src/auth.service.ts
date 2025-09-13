import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerRepository } from './repository/customer.repository';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginCustomerDto } from './dto/login-customer.dto';
import * as bcrypt from 'bcryptjs';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RegisterCustomerResponseDto } from './dto/register-customer-response.dto';
import { ValidateTokenResponseDto } from './dto/validate-token-response.dto';
import { LoggerService } from '@lib/logger/src/logger.service';
import { AddressService } from '@lib/address';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateAddrDataResponseDto } from './dto/create-addr-response.dto';
import { RedisClientService } from '@lib/redis-client'; // Import RedisClientService
import { Customer } from './entity/customer.entity'; // Import Customer entity for typing

const USER_CACHE_KEY_PREFIX = 'user_info_';
const USER_CACHE_TTL_SECONDS = 3600; // 1 hour, adjust as needed

@Injectable()
export class AuthService {
  private tokenBlacklist: Set<string> = new Set(); // This local blacklist might be less effective in a distributed setup. Consider Redis for this too.
  private context = AuthService.name;
  constructor(
    private readonly custRepository: CustomerRepository,
    private jwtService: JwtService,
    private logger: LoggerService,
    private addressService: AddressService,
    private readonly redisClient: RedisClientService, // Inject RedisClientService
  ) {}

  // Register customer
  async register(
    registerDto: RegisterCustomerDto,
  ): Promise<RegisterCustomerResponseDto> {
    const { name, email, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCustomer = await this.custRepository.create({
      name,
      email,
      password: hashedPassword,
    });
    
    // Cache user info upon registration
    if (newCustomer) {
      const cacheKey = `${USER_CACHE_KEY_PREFIX}${newCustomer.id}`;
      // Selectively cache what's needed, avoid caching password and include only available fields
      const userToCache = {
        id: newCustomer.id,
        email: newCustomer.email,
        name: newCustomer.name,
        phoneNumber: newCustomer.phoneNumber,
        countryCode: newCustomer.countryCode
      };
      await this.redisClient.setJson(cacheKey, userToCache, USER_CACHE_TTL_SECONDS);
      this.logger.info(`User ${newCustomer.email} (ID: ${newCustomer.id}) registered and cached.`, this.context);
    }
    
    return {
      message: 'Customer registered successfully',
      data: {
        id: newCustomer.id.toString(), // DTO expects string ID
        name: newCustomer.name,
        email: newCustomer.email,
      },
    };
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
        correlationId,
      },
      this.context,
    );

    const payload = { // This is for JWT
      email: customer.email,
      id: customer.id,
      name: customer.name,
    };

    // Cache user info upon login
    const cacheKey = `${USER_CACHE_KEY_PREFIX}${customer.id}`;
    const userToCache = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        countryCode: customer.countryCode
    };
    await this.redisClient.setJson(cacheKey, userToCache, USER_CACHE_TTL_SECONDS);
    this.logger.info(`User ${customer.email} (ID: ${customer.id}) logged in and cached.`, this.context);

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
  
  async getCachedUserById(userId: number): Promise<Partial<Customer> | null> {
    const cacheKey = `${USER_CACHE_KEY_PREFIX}${userId}`;
    this.logger.debug(`Attempting to fetch user ID ${userId} from cache. Cache key: ${cacheKey}`, this.context);
    const cachedUser = await this.redisClient.getJson<Partial<Customer>>(cacheKey);
    if (cachedUser) {
      this.logger.info(`Returning user ID ${userId} from cache.`, this.context);
      return cachedUser;
    }
    // Optionally fetch from DB and cache if not found, or let other services handle DB fetch
    this.logger.info(`User ID ${userId} not found in cache.`, this.context);
    return null;
  }


  // Update customer info
  async update(id: number, updateData: Partial<UpdateCustomerDto>) {
    const updatedCustomer = await this.custRepository.update(id, updateData);
    if (updatedCustomer) {
      // Update cache
      const cacheKey = `${USER_CACHE_KEY_PREFIX}${id}`;
      // Fetch the full updated customer to ensure cache consistency if updateData is partial
      const fullCustomer = await this.custRepository.findById(id); // Use the new public method
      if (fullCustomer) {
        const userToCache = {
            id: fullCustomer.id,
            email: fullCustomer.email,
            name: fullCustomer.name,
            phoneNumber: fullCustomer.phoneNumber,
            countryCode: fullCustomer.countryCode
        };
        await this.redisClient.setJson(cacheKey, userToCache, USER_CACHE_TTL_SECONDS);
        this.logger.info(`User ID ${id} updated and cache refreshed.`, this.context);
      } else {
        // If somehow not found after update, just delete stale cache
        this.logger.info(`User ID ${id} not found after update attempt, deleting stale cache if any.`, this.context);
        await this.redisClient.del(cacheKey);
      }
    }
    return updatedCustomer;
  }

  // Logout - invalidate user cache and add token to blacklist (if still using local blacklist)
  async logout(token: string, userId?: number): Promise<void> {
    // For a more robust blacklist, use Redis with TTL for tokens
    this.tokenBlacklist.add(token);
    this.logger.info(`Token added to local blacklist. Consider using Redis for distributed blacklist.`, this.context);

    if (userId) {
      const cacheKey = `${USER_CACHE_KEY_PREFIX}${userId}`;
      await this.redisClient.del(cacheKey);
      this.logger.info(`User ID ${userId} cache invalidated upon logout.`, this.context);
    }
  }

  isTokenBlacklisted(token: string): boolean {
    // This check remains local. For distributed, check against Redis blacklist.
    return this.tokenBlacklist.has(token);
  }

  validateToken(token: string): ValidateTokenResponseDto {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET, // Ensure JWT_SECRET is loaded via ConfigService for consistency
      });
      // Optionally, re-cache/update TTL for user info here if active
      // const cacheKey = `${USER_CACHE_KEY_PREFIX}${payload.id}`;
      // this.redisClient.getClient().expire(cacheKey, USER_CACHE_TTL_SECONDS); // Refresh TTL
      return payload as ValidateTokenResponseDto;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`, this.context);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async createAddress(
    userId: number,
    address: CreateAddressDto,
  ): Promise<CreateAddrDataResponseDto> {
    return (await this.addressService.createAddress(
      address,
      userId,
    )) as unknown as CreateAddrDataResponseDto;
  }

  async getAddresses(userId: number): Promise<CreateAddrDataResponseDto[]> {
    return (await this.addressService.fetchUserAddress(userId)) as unknown as CreateAddrDataResponseDto[];
  }

  async updateAddress(
    userId: number,
    addressId: number,
    address: CreateAddressDto,
  ): Promise<CreateAddrDataResponseDto> {
    return (await this.addressService.update(
      addressId,
      address,
    )) as unknown as CreateAddrDataResponseDto;
  }

  async deleteAddress(userId: number, addressId: number): Promise<boolean> {
    try {
      return await this.addressService.delete(userId, addressId);
    } catch (error) {
      throw error;
    }
  }
}
