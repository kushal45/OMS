import { Module, forwardRef } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { LoggerService } from './logger.service';
import { LoggerErrorInterceptor } from './interceptor/logger.error.interceptor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    ConfigModule,
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const esHost = configService.get<string>('ELASTICSEARCH_HOST');
        // Support comma-separated list of hosts
        const nodes = esHost
          ? esHost.split(',').map((host) => host.trim())
          : [];

        return {
          nodes,
          // Add connection pool settings for load balancing
          maxRetries: 10,
          requestTimeout: 60000,
          sniffOnStart: true,
        };
      },
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const esHost = configService.get<string>('ELASTICSEARCH_HOST');
        const serviceName = configService.get<string>(
          'SERVICE_NAME',
          'unknown',
        );

        if (!esHost) {
          console.warn(
            'ELASTICSEARCH_HOST not configured, using console transport only',
          );
          return {
            transports: [
              new winston.transports.Console({
                format: winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.json(),
                ),
              }),
            ],
          };
        }

        // Support comma-separated list of hosts for winston-elasticsearch
        const nodes = esHost.split(',').map((host) => host.trim());

        const esTransport = new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            nodes,
            maxRetries: 5,
            requestTimeout: 30000,
            sniffOnStart: true,
            context: {
              service: serviceName,
            },
          },
          transformer: (logData) => {
            // Ensure message is a plain string
            const { message, ...meta } = logData;
            return {
              ...meta,
              message:
                typeof message === 'string' ? message : JSON.stringify(message),
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
    LoggerService,
    {
      provide: 'LoggerErrorInterceptor',
      useFactory: (loggerService: LoggerService) =>
        new LoggerErrorInterceptor(loggerService),
      inject: [LoggerService],
    },
  ],
  exports: [WinstonModule, LoggerService, 'LoggerErrorInterceptor'],
})
export class LoggerModule {}
