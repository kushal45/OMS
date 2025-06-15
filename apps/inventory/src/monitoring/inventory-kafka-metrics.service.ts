import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class InventoryKafkaMetricsService {
  private readonly logger = new Logger(InventoryKafkaMetricsService.name);
  private readonly registry = new Registry();

  public readonly kafkaReserveEventsTotal: Counter<string>;
  public readonly kafkaReserveEventsFailed: Counter<string>;
  public readonly kafkaReserveEventsDuration: Histogram<string>;

  constructor() {
    this.kafkaReserveEventsTotal = new Counter({
      name: 'inventory_kafka_reserve_events_total',
      help: 'Total reserveInventory events processed',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.kafkaReserveEventsFailed = new Counter({
      name: 'inventory_kafka_reserve_events_failed',
      help: 'Total failed reserveInventory events',
      labelNames: ['reason'],
      registers: [this.registry],
    });
    this.kafkaReserveEventsDuration = new Histogram({
      name: 'inventory_kafka_reserve_events_duration_seconds',
      help: 'Duration of reserveInventory event processing',
      labelNames: ['result'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  getMetrics() {
    return this.registry.metrics();
  }
}
