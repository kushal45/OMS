import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutResponseDto {
  @ApiProperty({ description: 'Status of the response', example: 'success' })
  @IsString()
  @IsNotEmpty()
  readonly status: string;

  @ApiProperty({ description: 'Response message', example: 'Logout successful' })
  @IsString()
  @IsNotEmpty()
  readonly message: string;
}