import { Controller, Post, Body, Put, UseGuards, Request,Req, Res, HttpStatus, UnauthorizedException, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ApiResponse } from '../../utils/response.decorator';
import { ResponseUtil } from "../../utils/response.util"
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RegisterCustomerResponseDto } from './dto/register-customer-response.dto';
import { RegisterErrResponseDto } from './dto/register-err-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ValidateTokenResponseDto } from './dto/validate-token-response.dto';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse(RegisterCustomerResponseDto,201)
  @ApiResponse(RegisterErrResponseDto,500)
  @ApiBody({ type: RegisterCustomerDto })  // This tells Swagger to expect a RegisterCustomerDto
  async register(@Body() registerDto: RegisterCustomerDto,@Res() response) {
    try {
      const newCustCreated=await this.authService.register(registerDto);
      ResponseUtil.success({
        response,
        message: 'The customer has been successfully registered.',
        data: newCustCreated,
        statusCode:HttpStatus.CREATED
      })
    } catch (error) {
       ResponseUtil.error({
        response,
        message: 'Internal Server Error',
        error: error.message,
        statusCode:HttpStatus.BAD_REQUEST
       })
    }
   

  }

  @Post('login')
  @ApiOperation({ summary: 'Customer login' })
  @ApiResponse(LoginResponseDto)
  @ApiResponse(RegisterErrResponseDto,500)
  @ApiBody({ type: LoginCustomerDto })  // This tells Swagger to expect a LoginCustomerDto in the body
  async login(@Body() loginDto: LoginCustomerDto, @Res() response) {
    try {
      const loggedInToken= await this.authService.login(loginDto);
      ResponseUtil.success({
        response,
        message: 'Successfully logged in.',
        data: loggedInToken,
        statusCode:HttpStatus.OK
      })
    } catch (error) {
      ResponseUtil.error({
        response,
        message: 'Unauthorized - Invalid credentials.',
        error: error.message,
        statusCode:HttpStatus.UNAUTHORIZED
      })
    }
    

  }

  @Put('update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update customer details' })
  @ApiBearerAuth()  // Add JWT authentication
  @ApiResponse(RegisterCustomerResponseDto)
  @ApiBody({ type: UpdateCustomerDto })
  async update(@Request() req, @Body() updateData: Partial<UpdateCustomerDto>,@Res() response) {
    try {
      console.log("request",req.user,"request body -->",req.body);
      const updatedCust= await this.authService.update(req.user.userId, updateData);
      return ResponseUtil.success({
        response,
        message: 'Customer details updated successfully.',
        data: updatedCust,
        statusCode:HttpStatus.OK
      });
    } catch (error) {
      console.log("Error is:: ->",error);
      ResponseUtil.error({
        response,
        message: 'Internal Server Error',
        error: error.message,
        statusCode:HttpStatus.INTERNAL_SERVER_ERROR
      })
    }
   
  }

  @Post('validate-token')
  @ApiOperation({ summary: 'Validate token' })
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } }) 
  @ApiResponse(ValidateTokenResponseDto)
  async validateToken(@Body('token') token: string) {
    const payload = await this.authService.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid token from validation');
    }
    return payload; // Return payload data if token is valid
  }

  @Post('createAddress')
  @ApiBearerAuth()  // JWT authentication
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create customer address' })

  async createAddress(@Req() req: any, @Res() response) {
    
    return ResponseUtil.success({
      response,
      message: 'Address created successfully',
      statusCode:HttpStatus.OK
    })
  }


  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer logout' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse(LoginResponseDto)
  @ApiResponse(RegisterErrResponseDto,500)
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
