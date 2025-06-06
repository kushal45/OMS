import { Test, TestingModule } from '@nestjs/testing';
import { OutboxWorkerService } from './outbox-worker.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OutboxEvent, OutboxEventStatus } from '../entity/outbox-event.entity';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { Repository } from 'typeorm';

describe('OutboxWorkerService', () => {
  let service: OutboxWorkerService;
  let outboxRepo: Repository<OutboxEvent>;
  let kafkaProducer: KafkaProducer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxWorkerService,
        {
          provide: getRepositoryToken(OutboxEvent),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: KafkaProducer,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OutboxWorkerService>(OutboxWorkerService);
    outboxRepo = module.get<Repository<OutboxEvent>>(getRepositoryToken(OutboxEvent));
    kafkaProducer = module.get<KafkaProducer>(KafkaProducer);
  });

  it('should publish pending events and mark as SENT', async () => {
    const event: OutboxEvent = {
      id: 1,
      eventType: 'RESERVE_INVENTORY',
      payload: { userId: 'u1', productId: 'p1', quantity: 1, traceId: 't1', eventType: 'RESERVE_INVENTORY', timestamp: new Date().toISOString() },
      status: OutboxEventStatus.PENDING,
      createdAt: new Date(),
      sentAt: null,
      error: null,
    };
    (outboxRepo.find as jest.Mock).mockResolvedValue([event]);
    (kafkaProducer.send as jest.Mock).mockResolvedValue(undefined);
    (outboxRepo.save as jest.Mock).mockResolvedValue({ ...event, status: OutboxEventStatus.SENT });

    await service.processPendingEvents();
    expect(kafkaProducer.send).toHaveBeenCalledWith('RESERVE_INVENTORY', expect.any(Object));
    expect(outboxRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: OutboxEventStatus.SENT }));
  });

  it('should mark event as FAILED if publish throws', async () => {
    const event: OutboxEvent = {
      id: 2,
      eventType: 'RESERVE_INVENTORY',
      payload: { userId: 'u2', productId: 'p2', quantity: 2, traceId: 't2', eventType: 'RESERVE_INVENTORY', timestamp: new Date().toISOString() },
      status: OutboxEventStatus.PENDING,
      createdAt: new Date(),
      sentAt: null,
      error: null,
    };
    (outboxRepo.find as jest.Mock).mockResolvedValue([event]);
    (kafkaProducer.send as jest.Mock).mockRejectedValue(new Error('Kafka error'));
    (outboxRepo.save as jest.Mock).mockResolvedValue({ ...event, status: OutboxEventStatus.FAILED });

    await service.processPendingEvents();
    expect(kafkaProducer.send).toHaveBeenCalled();
    expect(outboxRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: OutboxEventStatus.FAILED }));
  });
});
