import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from '../entity/outbox-event.entity';
import { ServiceLocator } from '../service.locator';

@Injectable()
export class OutboxAdminService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly serviceLocator: ServiceLocator,
  ) {}

  async listFailedEvents(): Promise<OutboxEvent[]> {
    return this.outboxRepo.find({ where: { status: OutboxEventStatus.FAILED }, order: { createdAt: 'ASC' } });
  }

  async retryEvent(eventId: number): Promise<OutboxEvent> {
    const event = await this.outboxRepo.findOne({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');
    if (event.status !== OutboxEventStatus.FAILED) throw new Error('Event is not failed');
    try {
      await this.serviceLocator.getKafkaProducer().send(event.eventType, {
        key: event.payload.userId || event.payload.traceId || String(event.id),
        value: [event.payload],
      });
      event.status = OutboxEventStatus.SENT;
      event.sentAt = new Date();
      event.error = null;
    } catch (err) {
      event.error = err.message;
    }
    return this.outboxRepo.save(event);
  }

  async deleteEvent(eventId: number): Promise<void> {
    await this.outboxRepo.delete(eventId);
  }
}
