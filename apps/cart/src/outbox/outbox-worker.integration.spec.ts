import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent, OutboxEventStatus } from '../entity/outbox-event.entity';
import { OutboxWorkerService } from './outbox-worker.service';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { Repository } from 'typeorm';
import { CartModule } from '../cart.module';
import { CartService } from '../cart.service';
import { AddItemToCartDto } from '../dto/cart-item.dto';

// This test assumes a test database and Kafka mock are available

describe('Outbox Integration', () => {
  let app: INestApplication;
  let outboxRepo: Repository<OutboxEvent>;
  let cartService: CartService;
  let kafkaProducer: KafkaProducer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'test_db',
          entities: [OutboxEvent],
          synchronize: true,
        }),
        CartModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    outboxRepo = app.get(getRepositoryToken(OutboxEvent));
    cartService = app.get(CartService);
    kafkaProducer = app.get(KafkaProducer);
    jest.spyOn(kafkaProducer, 'send').mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create outbox event when adding item to cart', async () => {
    const userId = 'integration-user';
    const traceId = 'integration-trace';
    const dto: AddItemToCartDto = { productId: '1', quantity: 1 };
    await cartService.addItemToCart(userId, dto, traceId);
    const events = await outboxRepo.find({ where: { status: OutboxEventStatus.PENDING } });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventType).toBe('RESERVE_INVENTORY');
  });

  it('should publish and mark event as SENT', async () => {
    const event = outboxRepo.create({
      eventType: 'RESERVE_INVENTORY',
      payload: { userId: 'integration-user', productId: '1', quantity: 1, traceId: 'integration-trace', eventType: 'RESERVE_INVENTORY', timestamp: new Date().toISOString() },
      status: OutboxEventStatus.PENDING,
    });
    await outboxRepo.save(event);
    const worker = app.get(OutboxWorkerService);
    await worker.processPendingEvents();
    const updated = await outboxRepo.findOne({ where: { id: event.id } });
    expect(updated.status).toBe(OutboxEventStatus.SENT);
  });
});
