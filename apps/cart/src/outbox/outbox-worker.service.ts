import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from '../entity/outbox-event.entity';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';

@Injectable()
export class OutboxWorkerService {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly INTERVAL_MS = 10000; // 10 seconds
  private interval: NodeJS.Timeout;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  onModuleInit() {
    this.start();
  }

  start() {
    this.logger.log('Starting Outbox Worker...');
    this.interval = setInterval(() => this.processPendingEvents(), this.INTERVAL_MS);
  }

  async processPendingEvents() {
    const pendingEvents = await this.outboxRepo.find({
      where: { status: OutboxEventStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 10,
    });
    for (const event of pendingEvents) {
      try {
        await this.kafkaProducer.send(event.eventType, {
          key: event.payload.userId || event.payload.traceId || String(event.id),
          value: [event.payload],
        });
        event.status = OutboxEventStatus.SENT;
        event.sentAt = new Date();
        event.error = null;
        this.logger.log(`Published outbox event ${event.id} to Kafka: ${event.eventType}`);
      } catch (err) {
        event.status = OutboxEventStatus.FAILED;
        event.error = err.message;
        this.logger.error(`Failed to publish outbox event ${event.id}: ${err.message}`);
      }
      await this.outboxRepo.save(event);
    }
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }
}
