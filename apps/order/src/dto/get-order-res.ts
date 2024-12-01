import { ApiProperty } from '@nestjs/swagger';

class AddressDto {
    @ApiProperty({ example: 4 })
    id: number;
  
    @ApiProperty({ example: 'test' })
    name: string;
  
    @ApiProperty({ example: 'test1@gmail.com' })
    email: string;
  
    @ApiProperty({ example: '9513803371' })
    phoneNumber: string;
  
    @ApiProperty({ example: '+92' })
    countryCode: string;
}

class UserDto {

}

export class OrderResponseDto {
    @ApiProperty({ example: 34 })
    id: number;
  
    @ApiProperty({ example: 'f0482ce3-f5ed-4506-a598-c8b3df004261' })
    aliasId: string;
  
    @ApiProperty({ example: 9 })
    addressId: number;
  
    @ApiProperty({ example: 4 })
    userId: number;
  
    @ApiProperty({ example: 'Pending' })
    orderStatus: string;
  
    @ApiProperty({ example: 23 })
    totalAmount: number;
  
    @ApiProperty({ example: 11.5 })
    deliveryCharge: number;
  
    @ApiProperty({ example: 2.33 })
    tax: number;
  
    @ApiProperty({ example: '2024-12-01T08:04:47.612Z' })
    createdAt: string;
  
    @ApiProperty({ example: '2024-12-01T08:04:47.612Z' })
    updatedAt: string;
  
    @ApiProperty({ type: AddressDto })
    address: AddressDto;
  
    @ApiProperty({ type: UserDto })
    user: UserDto;
  }