/* eslint-disable max-len */
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { SecuritySchemeObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { injectDocumentComponents } from './injection';
import { removeEndpointsWithoutApiKey, transformDocument } from './open.api.manipulation.component';

export const API_KEY_SECURITY_DEFINITIONS: SecuritySchemeObject = {
  type: 'apiKey',
  name: 'Authorization',
  in: 'header',
  description: 'API key authentication. Allowed headers-- "Authorization: ApiKey <api_key>".',
};
const options = new DocumentBuilder()
  .setTitle('Novu API')
  .setDescription('REST API..')
  .setVersion('1.0')
  .setContact('OMS Support', 'https://discord.gg/oms', 'oms@novu.co')
  .setExternalDoc('OMS Documentation', '')
  .setTermsOfService('')
  .setLicense('MIT', 'https://opensource.org/license/mit')
  .addApiKey( // Define the 'api-key' security scheme
    {
      type: 'apiKey',
      name: 'Authorization', // This is the actual HTTP header name
      in: 'header',
      description: 'API key authentication. Usage: Authorization: ApiKey YOUR_API_KEY_HERE',
    },
    'api-key' // This name must match what removeEndpointsWithoutApiKey expects
  )
  .addBearerAuth(); // Defines the 'bearer' scheme
export const setupSwagger = async (app: INestApplication,path:string) => {
  const document = injectDocumentComponents(
    SwaggerModule.createDocument(app, options.build(), {
      operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`,
      deepScanRoutes: true,
      ignoreGlobalPrefix: false,
      include: [],
      extraModels: [],
    })
  );

  SwaggerModule.setup(path, app, {
    ...document,
    info: {
      ...document.info,
      title: `DEPRECATED: ${document.info.title}. Use /openapi.{json,yaml} instead.`,
    },
  });
  SwaggerModule.setup('openapi', app, removeEndpointsWithoutApiKey(document), {
    explorer: process.env.NODE_ENV !== 'production',
  });
  sdkSetup(app, document);
};
function sdkSetup(app: INestApplication, document: OpenAPIObject) {
  // eslint-disable-next-line no-param-reassign
  document['x-speakeasy-name-override'] = [
    { operationId: '^.*get.*', methodNameOverride: 'retrieve' },
    { operationId: '^.*retrieve.*', methodNameOverride: 'retrieve' },
    { operationId: '^.*create.*', methodNameOverride: 'create' },
    { operationId: '^.*update.*', methodNameOverride: 'update' },
    { operationId: '^.*list.*', methodNameOverride: 'list' },
    { operationId: '^.*delete.*', methodNameOverride: 'delete' },
    { operationId: '^.*remove.*', methodNameOverride: 'delete' },
  ];
  // eslint-disable-next-line no-param-reassign
  document['x-speakeasy-retries'] = {
    strategy: 'backoff',
    backoff: {
      initialInterval: 500,
      maxInterval: 30000,
      maxElapsedTime: 3600000,
      exponent: 1.5,
    },
    statusCodes: ['408', '409', '429', '5XX'],
    retryConnectionErrors: true,
  };

  SwaggerModule.setup('openapi.sdk', app, transformDocument(document), {
    explorer: process.env.NODE_ENV !== 'production',
  });
}
