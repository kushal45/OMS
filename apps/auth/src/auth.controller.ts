import { Controller, Post, Body, Put, UseGuards, Request,Req, Res, HttpStatus, UnauthorizedException, Get, Delete, NotAcceptableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { ApiResponse } from '../../utils/response.decorator';
import { ResponseUtil } from "../../utils/response.util"
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RegisterCustomerResponseDto } from './dto/register-customer-response.dto';
import { LoginResponseDataDto } from './dto/login-response.dto';
import { ValidateTokenResponseDto } from './dto/validate-token-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { ResponseFormatDto } from '../../utils/dto/response-format.dto';
import { ResponseErrDto } from '../../utils/dto/response-err.dto';
import { CreateAddrDataResponseDto } from './dto/create-addr-response.dto';


@ApiTags('auth')
@ApiSecurity('api-key')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse(RegisterCustomerResponseDto,201)
  @ApiResponse(ResponseErrDto,500)
  @ApiBody({ type: RegisterCustomerDto })  // This tells Swagger to expect a RegisterCustomerDto
  async register(@Body() registerDto: RegisterCustomerDto,@Res() response) {
      const newCustCreated=await this.authService.register(registerDto);
      ResponseUtil.success({
        response,
        message: 'The customer has been successfully registered.',
        data: newCustCreated,
        statusCode:HttpStatus.CREATED
      })
  }

  @Post('login')
  @ApiOperation({ summary: 'Customer login' })
  @ApiResponse(LoginResponseDataDto,200)
  @ApiResponse(ResponseErrDto,500)
  @ApiBody({ type: LoginCustomerDto })  // This tells Swagger to expect a LoginCustomerDto in the body
  async login(@Request() req,@Body() loginDto: LoginCustomerDto, @Res() response) {
      const correlationId= req.headers['x-correlation-id'];
      const loggedInToken= await this.authService.login(correlationId,loginDto);
      ResponseUtil.success({
        response,
        message: 'Successfully logged in.',
        data: loggedInToken,
        statusCode:HttpStatus.OK
      })
  }

  @Put('update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update customer details' })
  @ApiBearerAuth()  // Add JWT authentication
  @ApiResponse(RegisterCustomerResponseDto)
  @ApiBody({ type: UpdateCustomerDto })
  async update(@Request() req, @Body() updateData: Partial<UpdateCustomerDto>,@Res() response) {
      console.log("request",req.user,"request body -->",req.body);
      const updatedCust= await this.authService.update(req.user.userId, updateData);
      ResponseUtil.success({
        response,
        message: 'Customer details updated successfully.',
        data: updatedCust,
        statusCode:HttpStatus.OK
      });
  }

  @Post('validate-token')
  @ApiOperation({ summary: 'Validate token' })
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } }) 
  @ApiResponse(ValidateTokenResponseDto)
  async validateToken(@Body('token') token: string, @Res() response) {
    const payload = await this.authService.validateToken(token);
    ResponseUtil.success({
      response,
      message: 'Token is valid',
      data: payload,
      statusCode: HttpStatus.OK
    });
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create customer address' })
  @ApiBody({ type: CreateAddressDto })
  @ApiBearerAuth()  // JWT authentication
  @UseGuards(JwtAuthGuard)
  @ApiResponse(
    CreateAddrDataResponseDto,
    201,
    false,
    {
      message: 'Address created successfully',
      data: {
        street: '123 Main St',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        pincode: '12345'
      },
      status: 'success'
    }
  )
  async createAddress(@Req() req: any, @Res() response, @Body() addressData: CreateAddressDto) {
    try {
      const addressCreated= await this.authService.createAddress(req.user.userId, addressData);
      ResponseUtil.success({
        response,
        message: 'Address created successfully',
        data: addressCreated,
        statusCode:HttpStatus.CREATED
      });
    } catch (error) {
      console.error("Error in createAddress:", error);
      throw new NotAcceptableException('Address could not be created');
    }
  }

  @Get('addresses')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get customer addresses' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse(
    CreateAddrDataResponseDto,
    200,
    true,
    {
      message: 'Addresses retrieved successfully',
      data: [
        {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          pincode: '12345'
        }
      ],
      status: 'success'
    }
  )
  async getAddresses(@Req() req: any, @Res() response) {
    try {
      const addresses = await this.authService.getAddresses(req.user.userId);
      ResponseUtil.success({
        response,
        message: 'Addresses retrieved successfully',
        data: addresses,
        statusCode:HttpStatus.OK
      });
    } catch (error) {
      console.error("Error in getAddresses:", error);
      throw new NotAcceptableException('Addresses could not be retrieved');
    }
  }

  @Put('addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update customer address' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse(CreateAddrDataResponseDto, 200, true)
  @ApiResponse(ResponseErrDto,500)
  @ApiBody({ type: CreateAddressDto })  // This tells Swagger to expect a CreateAddressDto in the body
  @ApiParam({ name: 'addressId', type: 'number' })  // This tells Swagger to expect a number in the URL parameter
  async updateAddress(@Req() req: any, @Res() response, @Body() addressData: CreateAddressDto) {
    const addressUpdated= await this.authService.updateAddress(req.user.userId, req.params.addressId, addressData);
    ResponseUtil.success({
      response,
      message: 'Address updated successfully',
      data: addressUpdated,
      statusCode:HttpStatus.OK
    });
  }

  @Delete('addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete customer address' })
  @ApiBearerAuth()  // JWT authentication
  @ApiParam({ name: 'addressId', type: 'number' })
  @ApiResponse(ResponseFormatDto)
  async deleteAddress(@Req() req: any, @Res() response) {
    try {
      await this.authService.deleteAddress(req.user.userId, req.params.addressId);
      console.log("Address deleted successfully");
      ResponseUtil.success({
        response,
        message: 'Address deleted successfully',
        statusCode:HttpStatus.NO_CONTENT
      });
    } catch (error) {
       throw new NotAcceptableException('Address could not be deleted');
    }
  }



  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer logout' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse(ResponseFormatDto)
  @ApiResponse(ResponseErrDto,500)
  async logout(@Req() req: any, @Res() response) {
    const token = req.headers.authorization.split(' ')[1];
    this.authService.logout(token);
     ResponseUtil.success({
      response,
      message: 'Logout successful',
      statusCode:HttpStatus.OK
    })
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  healthCheck(@Res() response) {
    response.status(HttpStatus.OK).send('OK');
  }

}
