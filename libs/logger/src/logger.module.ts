import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { CustomLoggerService } from './logger.service';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => {
        const esTransport = new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_HOST,
            context:{
              service: process.env.SERVICE_NAME
            }
          },
        });

        return {
          transports: [
            esTransport,
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              ),
            }),
          ],
        };
      },
    }),
  ],
  providers: [CustomLoggerService],
  exports: [WinstonModule,CustomLoggerService],
})
export class LoggerModule {}