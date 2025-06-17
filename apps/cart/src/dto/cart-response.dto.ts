import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemDto } from './cart-item.dto'; // Assuming CartItemDto is in the same directory

export class CartResponseDto {
  @ApiProperty({ description: 'The unique identifier for the cart (if persisted)', example: 789, required: false })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'The user ID associated with this cart', example: 123 })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ type: () => [CartItemDto], description: 'The list of items in the cart' })
  @IsArray()
  //@ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ description: 'The subtotal of all items in the cart before discounts or taxes', example: 150.75 })
  @IsNumber()
  @Min(0)
  subTotal: number;

  @ApiProperty({ description: 'Total quantity of items in the cart', example: 5 })
  @IsInt()
  @Min(0)
  totalItems: number;

  // Optional fields, can be added if cart service calculates these
  @ApiProperty({ description: 'Discounts applied to the cart', example: 10.00, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @ApiProperty({ description: 'Taxes for the cart', example: 15.00, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tax?: number;

  @ApiProperty({ description: 'Total amount for the cart after discounts and taxes', example: 155.75, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  grandTotal?: number;

  @ApiProperty({ description: 'Timestamp of the last update to the cart', example: '2024-05-25T10:30:00Z', required: false })
  @IsOptional()
  updatedAt?: Date;
}