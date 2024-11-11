import { Controller, Post, Body, Put, UseGuards, Request,Req, Res, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ResponseUtil } from "../../utils/response.util"
import { UpdateCustomerDto } from './dto/update-customer.dto';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse({ status: 201, description: 'The customer has been successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad request or validation error.' })
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
  @ApiResponse({ status: 200, description: 'Successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials.' })
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
  @ApiResponse({ status: 200, description: 'Customer details updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token or no token.' })
  @ApiResponse({ status: 400, description: 'Bad request or validation error.' })
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
  @ApiResponse({ status: 200, description: 'Token is valid.' })
  @ApiResponse({ status: 401, description: 'Invalid token.' })
  async validateToken(@Body('token') token: string) {
    const payload = await this.authService.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid token from validation');
    }
    return payload; // Return payload data if token is valid
  }


  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer logout' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  async logout(@Req() req: any, @Res() response) {
    const token = req.headers.authorization.split(' ')[1];
    this.authService.logout(token);
     ResponseUtil.success({
      response,
      message: 'Logout successful',
      statusCode:HttpStatus.OK
    })
  }
}
