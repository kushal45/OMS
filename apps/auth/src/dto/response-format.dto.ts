import { ApiProperty, getSchemaPath } from "@nestjs/swagger";

export class ResponseFormatDto<T> {
    @ApiProperty({ description: 'Response message' })
    message: string;
  
    @ApiProperty({
        description: 'Response data',
        type: 'object',
      })
      data?: T;    
    @ApiProperty({ description: 'Status of the response', example: 'success' })
    status: string;
  }