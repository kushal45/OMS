import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { CustomLoggerService } from './logger.service';
import { LoggerErrorInterceptor } from './interceptor/logger.error.interceptor';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => {
        const esTransport = new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_HOST,
            context: {
              service: process.env.SERVICE_NAME,
            },
          },
          transformer: (logData) => {
            // Ensure message is a plain string
            const { message, ...meta } = logData;
            return {
              ...meta,
              message: typeof message === 'string' ? message : JSON.stringify(message),
            };
          },
        });

        return {
          transports: [
            esTransport,
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
            }),
          ],
        };
      },
    }),
  ],
  providers: [
    CustomLoggerService,
    {
      provide: 'LoggerErrorInterceptor',
      useFactory: (logger:CustomLoggerService) => new LoggerErrorInterceptor(logger),
      inject: ['winston',CustomLoggerService], // Inject Winston logger instance
    },
  ],
  exports: [WinstonModule, CustomLoggerService,'LoggerErrorInterceptor'],
})
export class LoggerModule {}
