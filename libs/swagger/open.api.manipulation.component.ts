import Nimma from 'nimma';
import { OpenAPIObject } from '@nestjs/swagger';

const jpath = '$.paths..responses["200","201"].content["application/json"]';

/**
 * @param {import("nimma").EmittedScope} scope
 */
function liftDataProperty(scope) {
  if (
    typeof scope.value !== 'object' ||
    !scope.value ||
    !('schema' in scope.value) ||
    typeof scope.value.schema !== 'object' ||
    !scope.value.schema
  ) {
    return;
  }

  const { schema } = scope.value;
  const data =
    'properties' in schema &&
    typeof schema.properties === 'object' &&
    schema.properties &&
    'data' in schema.properties &&
    typeof schema.properties.data === 'object'
      ? schema.properties.data
      : null;
  if (!data) {
    return;
  }

  // eslint-disable-next-line no-param-reassign
  scope.value.schema = data;
}
export function removeEndpointsWithoutApiKey<T>(openApiDocument: T): T {
  const parsedDocument = JSON.parse(JSON.stringify(openApiDocument));

  if (!parsedDocument.paths) {
    throw new Error('Invalid OpenAPI document');
  }

  // eslint-disable-next-line guard-for-in
  for (const path in parsedDocument.paths) {
    const operations = parsedDocument.paths[path];
    // eslint-disable-next-line guard-for-in
    for (const method in operations) {
      const operation = operations[method];
      if (operation.security && Array.isArray(operation.security) && operation.security.length > 0) {
        const hasApiKey = operation.security.some((sec: { [key: string]: string[] }) =>
          Object.keys(sec).includes('api-key')
        );

        if (!hasApiKey) {
          delete operations[method]; // Delete if no 'api-key' scheme
        }
        // If 'api-key' is present, we DO NOT filter operation.security here.
        // This preserves other schemes like 'bearer' if they co-exist with 'api-key'.
        // The original line that filtered operation.security has been removed.
      } else {
        // Operation has no security defined.
        // If the policy for this Swagger UI is that all endpoints must be secured by at least an api-key,
        // then these should also be deleted.
        delete operations[method];
      }
    }
    if (Object.keys(operations).length === 0) {
      delete parsedDocument.paths[path];
    }
  }

  return parsedDocument;
}
export function transformDocument(inputDocument: OpenAPIObject) {
  Nimma.query(inputDocument, {
    [jpath]: liftDataProperty,
  });

  return removeEndpointsWithoutApiKey(inputDocument) as OpenAPIObject;
}
