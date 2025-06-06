import { IsInt, IsPositive, IsArray, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string; // Changed from number

  @IsInt()
  @IsPositive()
  price: number;

  @IsInt()
  @IsPositive()
  quantity: number;
}

export class ValidateOrderItemsReqDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];
}