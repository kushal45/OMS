import { ApiExtraModels, getSchemaPath, ApiResponseOptions } from '@nestjs/swagger';
import { applyDecorators, Type } from '@nestjs/common';
import { customResponseDecorators } from '@lib/swagger/responses.decorator';
import { COMMON_RESPONSES } from '@lib/constants/responses.schema';
import { DataWrapperDto } from '@lib/dtos/data-wrapper-dto';

export const { ApiOkResponse }: { ApiOkResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiCreatedResponse }: { ApiCreatedResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiAcceptedResponse }: { ApiAcceptedResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiNoContentResponse }: { ApiNoContentResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const {
  ApiMovedPermanentlyResponse,
}: { ApiMovedPermanentlyResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const { ApiFoundResponse }: { ApiFoundResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiBadRequestResponse }: { ApiBadRequestResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const {
  ApiUnauthorizedResponse,
}: { ApiUnauthorizedResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiTooManyRequestsResponse,
}: { ApiTooManyRequestsResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const { ApiNotFoundResponse }: { ApiNotFoundResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const {
  ApiInternalServerErrorResponse,
}: { ApiInternalServerErrorResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const { ApiBadGatewayResponse }: { ApiBadGatewayResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiConflictResponse }: { ApiConflictResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const { ApiForbiddenResponse }: { ApiForbiddenResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const {
  ApiGatewayTimeoutResponse,
}: { ApiGatewayTimeoutResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const { ApiGoneResponse }: { ApiGoneResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;
export const {
  ApiMethodNotAllowedResponse,
}: { ApiMethodNotAllowedResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiNotAcceptableResponse,
}: { ApiNotAcceptableResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiNotImplementedResponse,
}: { ApiNotImplementedResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiPreconditionFailedResponse,
}: { ApiPreconditionFailedResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiPayloadTooLargeResponse,
}: { ApiPayloadTooLargeResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiRequestTimeoutResponse,
}: { ApiRequestTimeoutResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiServiceUnavailableResponse,
}: { ApiServiceUnavailableResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiUnprocessableEntityResponse,
}: { ApiUnprocessableEntityResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const {
  ApiUnsupportedMediaTypeResponse,
}: { ApiUnsupportedMediaTypeResponse: (options?: ApiResponseOptions) => MethodDecorator } = customResponseDecorators;
export const { ApiDefaultResponse }: { ApiDefaultResponse: (options?: ApiResponseOptions) => MethodDecorator } =
  customResponseDecorators;

export const ApiResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  statusCode: 200 | 201|400|401 |500 = 200,
  isResponseArray = false,
  example?: any
) => {
  const Response = getApiResponseType(statusCode);

  return applyDecorators(
    ApiExtraModels(DataWrapperDto, dataDto),
    Response({
      description: getApiDescription(statusCode),
      schema: {
        properties: isResponseArray
          ? { data: { type: 'array', items: { $ref: getSchemaPath(dataDto) } } }
          : { data: { $ref: getSchemaPath(dataDto) } },
        ...(example ? { example } : {}),
      },
    })
  );
};

function getApiResponseType(statusCode:number): (options?: ApiResponseOptions) => MethodDecorator {
   switch(statusCode){
      case 200:
      case 201:
        return ApiOkResponse;
      case 400:
        return ApiBadRequestResponse;
      case 401:
        return ApiUnauthorizedResponse;
      case 500:
        return ApiInternalServerErrorResponse;
   }

}

function getApiDescription(statusCode: number): string {

  switch(statusCode){
    case 200:
      return 'Ok';
    case 201:
      return 'Created';
    case 400:
      return 'Bad Request';
    case 500:
      return 'Internal Server Error';
  }
}

export const ApiCommonResponses = () => {
  return applyDecorators(
    ...Object.entries(COMMON_RESPONSES).map(([decoratorName, responseOptions]) =>
      customResponseDecorators[decoratorName](responseOptions)
    )
  );
};
