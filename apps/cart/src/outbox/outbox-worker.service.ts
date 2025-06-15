import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from '../entity/outbox-event.entity';
import { ServiceLocator } from '../service.locator';

@Injectable()
export class OutboxWorkerService {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly INTERVAL_MS = 10000; // 10 seconds
  private interval: NodeJS.Timeout;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly serviceLocator: ServiceLocator,
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
      where: { status: Not(OutboxEventStatus.SENT) },
      order: { createdAt: 'ASC' },
      take: 10,
    });
    for (const event of pendingEvents) {
      try {
        let kafkaProduceRes = [];
        let attempt = 0;
        const maxRetries = 10;
        let lastError: any;
        // Extract messages to publish based on payload structure
        const messagesToPublish = this.extractMessagesToPublish(event.payload);
        for (const messagePayload of messagesToPublish) {
          attempt = 0;
          lastError = undefined;
          while (attempt < maxRetries) {
            try {
              kafkaProduceRes = await this.serviceLocator.getKafkaProducer().send(event.eventType, {
                key: messagePayload.userId || messagePayload.traceId || messagePayload.orderId || String(event.id),
                value: [messagePayload],
              });
              if (
                kafkaProduceRes.length === 0 ||
                (kafkaProduceRes[0] && kafkaProduceRes[0].errorCode && kafkaProduceRes[0].errorCode !== 0)
              ) {
                throw new Error('Kafka returned errorCode or no response');
              }
              break; // Success
            } catch (error) {
              lastError = error;
              this.logger.error(
                `Kafka send error for event ${event.id} (attempt ${attempt + 1}): ${error.message}`,
                error.stack,
              );
              if (
                error.message &&
                error.message.includes("coordinator is loading")
              ) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                attempt++;
                continue;
              }
              break;
            }
          }
          if (kafkaProduceRes.length === 0 || (kafkaProduceRes[0] && kafkaProduceRes[0].errorCode && kafkaProduceRes[0].errorCode !== 0)) {
            this.logger.error(`Failed to produce message to Kafka for event ${event.id}: ${JSON.stringify(kafkaProduceRes)}`);
            throw lastError || new Error('Failed to produce message to Kafka');
          }
        }
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

  /**
   * Extracts messages to publish from the event payload.
   * If payload has an 'items' array, returns a message for each item merged with the rest of the payload (excluding 'items').
   * Otherwise, returns the payload as a single message.
   */
  private extractMessagesToPublish(payload: any): any[] {
    if (payload && Array.isArray(payload.items)) {
      // Remove 'items' from the base payload
      const { items, ...basePayload } = payload;
      return items.map((item: any) => ({ ...basePayload, ...item }));
    }
    return [payload];
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }
}
