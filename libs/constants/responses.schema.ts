import { ApiResponseOptions } from '@nestjs/swagger';
import { ApiResponseDecoratorName } from '@lib/http/responses.types';
import { HttpResponseHeaderKeysEnum } from '@lib/http/headers.types';
import { createReusableHeaders } from '@lib/swagger/headers.decorator';

export const COMMON_RESPONSES: Partial<
  Record<ApiResponseDecoratorName, ApiResponseOptions>
> = {
  ApiConflictResponse: {
    description:
      'The request could not be completed due to a conflict with the current state of the target resource.',
    schema: {
      type: 'string',
      example:
        'Request with key 3909d656-d4fe-4e80-ba86-90d3861afcd7 is currently being processed. Please retry after 1 second',
    },
    headers: createReusableHeaders([
      HttpResponseHeaderKeysEnum.RETRY_AFTER,
      HttpResponseHeaderKeysEnum.LINK,
    ]),
  },
  ApiServiceUnavailableResponse: {
    description:
      'The server is currently unable to handle the request due to a temporary overload or scheduled maintenance, which will likely be alleviated after some delay.',
    schema: {
      type: 'string',
      example: 'Please wait some time, then try again.',
    },
    headers: createReusableHeaders([HttpResponseHeaderKeysEnum.RETRY_AFTER]),
  },
};
