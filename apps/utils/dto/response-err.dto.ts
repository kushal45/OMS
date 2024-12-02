import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ResponseErrDto {
  @ApiProperty({ description: 'Status of the response', example: 'error' })
  @IsString()
  @IsNotEmpty()
  readonly status: string;

  @ApiProperty({ description: 'Error message' })
  @IsString()
  @IsNotEmpty()
  readonly message: string;

  @ApiProperty({ description: 'Error details', type: 'object', required: false })
  @IsOptional()
  readonly error: unknown;
}