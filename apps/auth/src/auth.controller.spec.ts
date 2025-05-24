import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
// Import RegisterCustomerResponseDto if you want to cast mockRegisterResponse to it for stricter type checking
// import { RegisterCustomerResponseDto } from './dto/register-customer-response.dto';
import { HttpStatus } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockRequest = {
      headers: {},
      user: null,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

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
            validateToken: jest.fn(),
            createAddress: jest.fn(),
            updateAddress: jest.fn(),
            deleteAddress: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  }); // Removed extra closing brace here

  describe('register', () => {
    it('should register a new customer', async () => {
      const registerDto: RegisterCustomerDto = { name: 'John Doe', email: 'john@example.com', password: 'password' };
      const mockRegisterResponse = {
        id: 1,
        name: registerDto.name,
        email: registerDto.email,
        // Ensure this matches the actual structure of RegisterCustomerResponseDto
      };
      jest.spyOn(authService, 'register').mockResolvedValue(mockRegisterResponse as any); // Cast as any or import DTO

      await authController.register(registerDto, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ // Use expect.objectContaining for flexibility
          message: 'The customer has been successfully registered.',
          data: mockRegisterResponse, // Use mockRegisterResponse here
        }),
      );
    });
  });

  describe('login', () => {
    it('should login a customer', async () => {
      const loginDto: LoginCustomerDto = { email: 'john@example.com', password: 'password' };
      const result = { accessToken: 'token' };
      jest.spyOn(authService, 'login').mockResolvedValue(result);

      await authController.login(mockRequest, loginDto, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Successfully logged in.',
          data: result,
        }),
      );
    });
  });

  describe('logout', () => {
    it('should logout a customer and return success response', async () => {
      const token = 'test-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      const logoutSpy = jest.spyOn(authService, 'logout').mockReturnValue(undefined);

      await authController.logout(mockRequest, mockResponse);

      expect(logoutSpy).toHaveBeenCalledWith(token);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logout successful',
        }),
      );
    });
  });
});