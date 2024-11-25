import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginResponseDataDto {
  @ApiProperty({ description: 'Access token for authentication' })
  accessToken: string;
}