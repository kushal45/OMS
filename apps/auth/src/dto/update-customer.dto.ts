import { IsString, IsEmail, IsNotEmpty,MinLength, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Optional } from '@nestjs/common';
export class UpdateCustomerDto {
    @ApiProperty({ description: 'The name of the customer' })
    @IsString()
    @IsNotEmpty()
    @Optional()
    readonly name: string;
  
    @ApiProperty({ description: 'The email of the customer' })
    @IsEmail()
    @IsNotEmpty()
    @Optional()
    readonly email: string;

    @ApiProperty({ description: 'phone number of customer' })
    @IsString()
    @IsNotEmpty()
    @IsPhoneNumber()
    @Optional()
    readonly phoneNumber: string;

    @ApiProperty({ description: 'country code of customer' })
    @IsString()
    @IsNotEmpty()
    @Optional()
    readonly countryCode: string;
}