import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../inventory.service';
import { InventoryRepository } from '../repository/inventory.repository';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerService } from '@lib/logger/src';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { InventoryUpdateHandler } from '../kafka-handlers/inventory-update.handler';
import { InventoryKafkaMetricsService } from '../monitoring/inventory-kafka-metrics.service';
import { EntityManager } from 'typeorm';

describe('InventoryService Kafka Subscription (refactored)', () => {
  let service: InventoryService;
  let kafkaConsumer: KafkaConsumer;
  let inventoryRepository: InventoryRepository;
  let transactionService: TransactionService;
  let logger: LoggerService;
  let metrics: InventoryKafkaMetricsService;

  beforeEach(async () => {
    kafkaConsumer = {
      subscribe: jest.fn(),
      postSubscribeCallback: jest.fn(),
    } as any;
    inventoryRepository = {
      getRepository: jest.fn().mockReturnValue({
        findByProductId: jest.fn(),
        update: jest.fn(),
      }),
    } as any;
    transactionService = {
      executeInTransaction: jest.fn((cb) => cb({} as EntityManager)),
    } as any;
    logger = { info: jest.fn(), error: jest.fn() } as any;
    metrics = {
      kafkaReserveEventsTotal: { inc: jest.fn() },
      kafkaReserveEventsFailed: { inc: jest.fn() },
      kafkaReserveEventsDuration: { startTimer: jest.fn(() => jest.fn()) },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: inventoryRepository },
        { provide: TransactionService, useValue: transactionService },
        { provide: LoggerService, useValue: logger },
        { provide: 'KafkaConsumerInstance', useValue: kafkaConsumer },
        { provide: InventoryUpdateHandler, useValue: {} },
        { provide: InventoryKafkaMetricsService, useValue: metrics },
      ],
    }).compile();
    service = module.get(InventoryService);
  });

  it('should call reserveInventory for valid Kafka event', async () => {
    const reserveSpy = jest.spyOn(service, 'reserveInventory').mockResolvedValue({
      overallSuccess: true,
     
      reservationDetails: [{ productId: 'p1', reserved: true, reason: '', currentStock: 8 }],
    });
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: 'p1', quantity: 2, price: 100, userId: 'u1', traceId: 'trace-1' }], {});
    expect(reserveSpy).toHaveBeenCalledWith({
     
      userId: 'u1',
      itemsToReserve: [{ productId: 'p1', quantity: 2, price: 100 }],
    });
    expect(metrics.kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'success' });
  });

  it('should log and metric failure if reserveInventory fails', async () => {
    const reserveSpy = jest.spyOn(service, 'reserveInventory').mockResolvedValue({
      overallSuccess: false,
      reservationDetails: [{ productId: 'p2', reserved: false, reason: 'INSUFFICIENT_STOCK', currentStock: 0 }],
    });
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: 'p2', quantity: 5, price: 0, userId: 'u2', traceId: 'trace-2' }], {});
    expect(reserveSpy).toHaveBeenCalled();
    expect(metrics.kafkaReserveEventsFailed.inc).toHaveBeenCalledWith({ reason: 'reserveInventory_failed' });
    expect(metrics.kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'failed' });
  });

  it('should log and metric exception if reserveInventory throws', async () => {
    const reserveSpy = jest.spyOn(service, 'reserveInventory').mockRejectedValue(new Error('DB error'));
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: 'p3', quantity: 1, price: 0, userId: 'u3', traceId: 'trace-3' }], {});
    expect(reserveSpy).toHaveBeenCalled();
    expect(metrics.kafkaReserveEventsFailed.inc).toHaveBeenCalledWith({ reason: 'exception' });
    expect(metrics.kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'failed' });
  });

  it('should log and metric invalid event', async () => {
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: '', quantity: 'bad' }], {});
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid reserveInventory event'),
      expect.any(String)
    );
    expect(metrics.kafkaReserveEventsFailed.inc).toHaveBeenCalledWith({ reason: 'invalid_event' });
    expect(metrics.kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'failed' });
  });
});
