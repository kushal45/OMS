import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { QueryInput } from '../interfaces/query-input.interface';


export class ValidateOrderItemsResponseDto {
  @IsBoolean()
  success: boolean;

  @IsOptional()
  invalidOrderItems?: QueryInput.InvalidOrderItemWithReason[];
}