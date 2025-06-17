import { IsInt, IsArray, ValidateNested, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';



export class OrderRequestDto {
  @ApiProperty({ description: 'The address ID', default: 1 })
  @IsInt()
  @IsNotEmpty()
  addressId: number= 1;
}