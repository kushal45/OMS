import { IsEmail, IsNotEmpty, MinLength} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginCustomerDto {
  @ApiProperty({ description: 'The email of the customer' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'The password of the customer' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}