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
  @Min(0.01, { message: 'Price must be at least 0.01' })
  @Max(10000, { message: 'Price must be at most 10000' })
  price: number = 1.0;
  @IsInt()
  @IsNotEmpty()
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