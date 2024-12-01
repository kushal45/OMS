import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested,Min,Max, isNumber} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateOrderItemDto {
  @IsOptional()
  @ApiProperty({ example: 1 })
  orderItemId?: number;
  @ApiProperty({ example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  quantity: number;

  @ApiProperty({ example: 10.3 })
  @IsNumber()
  @Min(1, { message: 'Price must be at least 1' })
  @Max(10000, { message: 'Price must be at most 10000' })
  price: number;
}

export class UpdateOrderDto {
  @ApiProperty({ example: 9 })
  @IsInt()
  addressId: number;

  @ApiProperty({ example: 'Pending' })
  @IsString()
  @IsOptional()
  orderStatus: string;

  @ApiProperty({ type: [UpdateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  orderItems: UpdateOrderItemDto[];
}