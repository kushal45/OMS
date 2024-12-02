import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

class RegisterCustomerDataDto {
  @ApiProperty({ description: 'ID of the customer' })
  @IsString()
  @IsNotEmpty()
  readonly id: string;

  @ApiProperty({ description: 'The name of the customer' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty({ description: 'The email of the customer' })
  @IsEmail()
  @IsNotEmpty()
  readonly email: string;
}

export class RegisterCustomerResponseDto {
  @ApiProperty({ description: 'Response message' })
  @IsString()
  @IsNotEmpty()
  readonly message: string;

  @ApiProperty({ type: RegisterCustomerDataDto, description: 'Response data' })
  readonly data: RegisterCustomerDataDto;
}