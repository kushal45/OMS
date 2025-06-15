import { ApiProperty, ApiExtraModels } from "@nestjs/swagger";


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

// Helper for array response
export function ApiArrayResponseFormat<TModel extends new (...args: any[]) => any>(model: TModel) {
  @ApiExtraModels(ResponseFormatDto)
  class TypedArrayResponseFormatDto extends ResponseFormatDto<InstanceType<TModel>[]> {
    @ApiProperty({
      description: 'Response data',
      isArray: true,
      type: model,
    })
    data: InstanceType<TModel>[];
  }
  return TypedArrayResponseFormatDto;
}

// Helper for single object response
export function ApiObjectResponseFormat<TModel extends new (...args: any[]) => any>(model: TModel) {
  @ApiExtraModels(ResponseFormatDto)
  class TypedObjectResponseFormatDto extends ResponseFormatDto<InstanceType<TModel>> {
    @ApiProperty({
      description: 'Response data',
      type: model,
    })
    data: InstanceType<TModel>;
  }
  return TypedObjectResponseFormatDto;
}