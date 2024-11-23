import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateTokenResponseDto {
  @ApiProperty({ description: 'Email of the customer' })
  @IsString()
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ description: 'ID of the customer' })
  @IsString()
  @IsNotEmpty()
  readonly sub: string;

  @ApiProperty({ description: 'Name of the customer' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;
}