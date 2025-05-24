import { IsInt, IsArray, ValidateNested, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({ description: 'The product ID' })
  @IsInt()
  @IsNotEmpty()
  productId: number = 1;

  @ApiProperty({ description: 'The price of the product' })
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Price must be a valid number' })
  @Min(1, { message: 'Price must be at least 1' })
  @Max(10000, { message: 'Price must be at most 10000' })
  price: number = 1.0;
  @ApiProperty({ description: 'The quantity of the product' })
  @IsInt({ message: 'Quantity must be an integer' })
  @IsNotEmpty({ message: 'Quantity cannot be empty' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(1000, { message: 'Quantity must be at most 1000' }) // Corrected limit and message
  quantity: number = 1;
}

export class OrderRequestDto {
  @ApiProperty({ description: 'The address ID', default: 1 })
  @IsInt()
  @IsNotEmpty()
  addressId: number= 1;

  @ApiProperty({ description: 'The list of order items' ,default: [{ productId: 1, price: 1.0, quantity: 1 }]})
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];
}