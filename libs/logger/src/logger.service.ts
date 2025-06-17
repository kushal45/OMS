import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService {
  private context: string;
  private readonly serviceName: string;
  private readonly samplingRate: number;
  private readonly bulkBuffer: any[] = [];
  private readonly bulkFlushInterval: number = 2000; // ms
  private readonly bulkBufferSize: number = 50; // flush when buffer reaches this size
  private bulkFlushTimer: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {
    this.serviceName = this.configService.get<string>(
      'SERVICE_NAME',
      'unknown',
    );
    this.samplingRate = Number(this.configService.get<string>('LOG_SAMPLING_RATE', '1'));
    this.startBulkFlushTimer();
  }

  private startBulkFlushTimer() {
    this.bulkFlushTimer = setInterval(() => this.flushBulkBuffer(), this.bulkFlushInterval);
  }

  private async flushBulkBuffer() {
    if (this.bulkBuffer.length === 0) return;
    const body = this.bulkBuffer.flatMap(doc => [{ index: { _index: doc.index } }, doc.body]);
    this.bulkBuffer.length = 0; // clear buffer
    try {
     //await this.elasticsearchService.bulk({ body });
     console.log('Flushing bulk buffer to Elasticsearch', body);
    } catch (error) {
      console.error('Failed to bulk log to Elasticsearch', error);
    }
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
    try {
      this.logToElasticsearch('error', message, trace, context);
      console.error(`[${this.getContext(context)}] ${message}`, trace);
    } catch (error) {
      console.error('Error logging to Elasticsearch:', error);
    }
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
    // Sampling: only log if random() < samplingRate
    if (Math.random() >= this.samplingRate) return;
    const index = `logs-${this.serviceName}-${level}-${new Date().toISOString().split('T')[0]}`;
    const body = {
      '@timestamp': new Date().toISOString(),
      service: this.serviceName,
      context: this.getContext(context),
      level,
      message,
      trace,
    };
    this.bulkBuffer.push({ index, body });
    if (this.bulkBuffer.length >= this.bulkBufferSize) {
      this.flushBulkBuffer();
    }
  }
}
