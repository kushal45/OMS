import { ApiProperty } from "@nestjs/swagger";


export class ResponseFormatDto<T = any> {
  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({
      description: 'Response data',
      type: 'object', // This will be replaced dynamically
  })
  data?: T;

  @ApiProperty({ description: 'Status of the response', example: 'success' })
  status: string;
}

export function ApiResponseFormat<T>(type: new () => T) {
  class TypedResponseFormatDto extends ResponseFormatDto<T> {
      @ApiProperty({
          description: 'Response data',
          type,
      })
      data: T;
  }
  return TypedResponseFormatDto;
}