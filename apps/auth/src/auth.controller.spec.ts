import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { Customer } from './entity/customer.entity';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest ={}
  });

  describe('register', () => {
    it('should register a new customer', async () => {
      const registerDto: RegisterCustomerDto = { name: 'John Doe', email: 'john@example.com', password: 'password' };
      const result = { id: 1, ...registerDto };
      jest.spyOn(authService, 'register').mockResolvedValue(result as Customer);

      await authController.register(registerDto, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'The customer has been successfully registered.',
        data: result,
      });
    });
  });

  describe('login', () => {
    it('should login a customer', async () => {
      const loginDto: LoginCustomerDto = { email: 'john@example.com', password: 'password' };
      const result = { accessToken: 'token' };
      jest.spyOn(authService, 'login').mockResolvedValue(result);

      await authController.login(loginDto, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Successfully logged in.',
        data: result,
      });
    });
  });

  describe('logout', () => {
    it('should logout a customer', async () => {
      const token = 'token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      jest.spyOn(authService, 'logout').mockReturnValue(undefined);
      await authController.logout(mockRequest, mockResponse);
    });
  });
});