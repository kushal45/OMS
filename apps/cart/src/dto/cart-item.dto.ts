import { IsString, IsNotEmpty, IsInt, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: 'The product ID', example: 'product-uuid-123' })
  @IsInt({ message: 'Product ID must be an integer' })
  @Min(1, { message: 'Product ID must be a positive integer' })
  @IsNotEmpty()
  productId: number;

  @ApiProperty({ description: 'The quantity of the product', example: 2, minimum: 1, maximum: 100 })
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(100, { message: 'Quantity must be at most 100' }) // Assuming a max cart quantity per item
  @IsNotEmpty()
  quantity: number;

  // Price might be fetched from product service at time of adding or checkout,
  // but can be included if cart stores snapshot of price at time of adding.
  @ApiProperty({ description: 'The price of the product at the time of adding to cart', example: 25.99, required: false })
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Price must be a valid number' })
  @Min(0.01, { message: 'Price must be positive' })
  price?: number; // Optional: depends on whether cart service stores price or fetches it
}

export class AddItemToCartDto {
  @ApiProperty({ description: 'The product ID to add', example: 456 })
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @ApiProperty({ description: 'The quantity to add', example: 1, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsNotEmpty()
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'The new quantity for the cart item', example: 3, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsNotEmpty()
  quantity: number;
}