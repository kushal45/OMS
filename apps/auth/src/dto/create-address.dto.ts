import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';


export class CreateAddressDto {
  @ApiProperty({ description: 'The street of the address', required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ description: 'The city of the address' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'The state of the address' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'The country of the address' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'The postal code of the address' })
  @IsString()
  @IsNotEmpty()
  pincode: string;
}