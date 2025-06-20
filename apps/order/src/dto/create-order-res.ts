import { IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum OrderStatus {
    Pending = 'Pending',
    Reserved = 'Reserved',
    Confirmed = 'Confirmed',
    Cancelled = 'Cancelled',
    Shipped = 'Shipped',
    Delivered = 'Delivered',
}

export class CreateOrderResponseDto {
  @ApiProperty({ description: 'The order ID' ,default: '123e4567-e89b-12d3-a456-426614174000'})
  @IsUUID()
  aliasId: string;

  @ApiProperty({ description: 'The order status', enum: OrderStatus, default: OrderStatus.Pending })
  @IsEnum(OrderStatus, { message: 'Status must be a valid enum value' })
  orderStatus: OrderStatus;

  @ApiProperty({ description: 'The order total amount', default: 100 })
  totalAmount: number;

  @ApiProperty({description:'tax amount',default:10})
  tax: number;
  @ApiProperty({description:'deliveryCharge',default:10})
  deliveryCharge: number;
}