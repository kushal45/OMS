import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService {
  private context: string;
  private readonly serviceName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {
    this.serviceName = this.configService.get<string>(
      'SERVICE_NAME',
      'unknown',
    );
  }

  setContext(context: string) {
    this.context = context;
    return this;
  }

  async info(message: Record<string, unknown> | string, context?: string) {
    this.logToElasticsearch('info', message, null, context);
    console.log(`[${this.getContext(context)}] ${message}`);
  }
  async debug(message: Record<string, unknown> | string, context?: string) {
    this.logToElasticsearch('debug', message, null, context);
    console.debug(`[${this.getContext(context)}] ${message}`);
  }

  async error(message: string, trace?: string, context?: string) {
    this.logToElasticsearch('error', message, trace, context);
    console.error(`[${this.getContext(context)}] ${message}`, trace);
  }

  private getContext(context?: string): string {
    return context || this.context || this.serviceName;
  }

  private async logToElasticsearch(
    level: string,
    message: Record<string, unknown> | string,
    trace?: string,
    context?: string,
  ) {
    try {
      await this.elasticsearchService.index({
        index: `logs-${this.serviceName}-${level}-${new Date().toISOString().split('T')[0]}`,
        body: {
          '@timestamp': new Date().toISOString(),
          service: this.serviceName,
          context: this.getContext(context),
          level,
          message,
          trace,
        },
      });
    } catch (error) {
      console.error('Failed to log to Elasticsearch', error);
    }
  }
}
