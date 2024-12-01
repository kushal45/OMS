import { ApiProperty } from '@nestjs/swagger';
export class OrderItemsResponseDto {
    @ApiProperty({ example: 11 })
    id: number;
  
    @ApiProperty({ example: 34 })
    orderId: number;
  
    @ApiProperty({ example: 1 })
    productId: number;
  
    @ApiProperty({ example: '2024-12-01T08:04:47.612Z' })
    creationDate: string;
  
    @ApiProperty({ example: '2024-12-01T08:04:47.612Z' })
    updatedDate: string;
  
    @ApiProperty({ example: 1 })
    quantity: number;
  }