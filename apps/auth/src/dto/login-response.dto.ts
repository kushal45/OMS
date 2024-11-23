import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

class LoginResponseDataDto {
  @ApiProperty({ description: 'Access token for authentication' })
  accessToken: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ type: LoginResponseDataDto, description: 'Response data' })
  data: LoginResponseDataDto;
}