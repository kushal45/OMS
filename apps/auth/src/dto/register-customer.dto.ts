import { IsString, IsEmail, IsNotEmpty,MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class RegisterCustomerDto {
    @ApiProperty({ description: 'The name of the customer' })
    @IsString()
    @IsNotEmpty()
    readonly name: string;
  
    @ApiProperty({ description: 'The email of the customer' })
    @IsEmail()
    @IsNotEmpty()
    readonly email: string;
  
    @ApiProperty({ description: 'The password of the customer' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    readonly password: string;
}