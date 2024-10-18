import { Controller, Post, Body, Put, UseGuards, Request,Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse({ status: 201, description: 'The customer has been successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad request or validation error.' })
  @ApiBody({ type: RegisterCustomerDto })  // This tells Swagger to expect a RegisterCustomerDto
  async register(@Body() registerDto: RegisterCustomerDto) {
    console.log("register request body",registerDto);
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Customer login' })
  @ApiResponse({ status: 200, description: 'Successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials.' })
  @ApiBody({ type: LoginCustomerDto })  // This tells Swagger to expect a LoginCustomerDto in the body
  async login(@Body() loginDto: LoginCustomerDto) {
    return this.authService.login(loginDto);
  }

  @Put('update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update customer details' })
  @ApiBearerAuth()  // Add JWT authentication
  @ApiResponse({ status: 200, description: 'Customer details updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token or no token.' })
  @ApiResponse({ status: 400, description: 'Bad request or validation error.' })
  async update(@Request() req, @Body() updateData: Partial<RegisterCustomerDto>) {
    return this.authService.updateCustomer(req.user.id, updateData);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer logout' })
  @ApiBearerAuth()  // JWT authentication
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  async logout(@Req() req: any) {
    const token = req.headers.authorization.split(' ')[1];
    return this.authService.logout(token);
  }
}
