import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../inventory.service';
import { InventoryRepository } from '../repository/inventory.repository';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerService } from '@lib/logger/src';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { InventoryUpdateHandler } from '../kafka-handlers/inventory-update.handler';
import { EntityManager } from 'typeorm';

describe('InventoryService Kafka Subscription', () => {
  let service: InventoryService;
  let kafkaConsumer: KafkaConsumer;
  let inventoryRepository: InventoryRepository;
  let transactionService: TransactionService;
  let logger: LoggerService;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: inventoryRepository },
        { provide: TransactionService, useValue: transactionService },
        { provide: LoggerService, useValue: logger },
        { provide: 'KafkaConsumerInstance', useValue: kafkaConsumer },
        { provide: InventoryUpdateHandler, useValue: {} },
      ],
    }).compile();
    service = module.get(InventoryService);
  });

  it('should subscribe to reserveInventory and process valid events', async () => {
    const mockUpdate = jest.fn();
    const mockFind = jest.fn().mockResolvedValue({
      id: 1,
      productId: 'p1',
      quantity: 10,
      reservedQuantity: 0,
      status: 'in-stock',
    });
    (inventoryRepository.getRepository as jest.Mock).mockReturnValue({
      findByProductId: mockFind,
      update: mockUpdate,
    });
    await service.onModuleInit();
    // Simulate the callback
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: 'p1', quantity: 2 }], {});
    expect(mockFind).toHaveBeenCalledWith('p1');
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ quantity: 8, reservedQuantity: 2 }));
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Reserved inventory for product p1'),
      expect.any(String)
    );
  });

  it('should log error for invalid event', async () => {
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, [{ productId: '', quantity: 'bad' }], {});
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid reserveInventory event'),
      expect.any(String)
    );
  });

  it('should handle reservation failure (insufficient stock) and increment metrics', async () => {
    // Arrange
    const mockReserveInventory = jest.spyOn(service, 'reserveInventory').mockResolvedValue({
      overallSuccess: false,
      reservationDetails: [{ productId: 'p2', reserved: false, reason: 'INSUFFICIENT_STOCK', currentStock: 0 }],
    });
    // Patch metrics
    service['inventoryKafkaMetrics'] = {
      kafkaReserveEventsFailed: { inc: jest.fn() },
      kafkaReserveEventsTotal: { inc: jest.fn() },
      kafkaReserveEventsDuration: { startTimer: jest.fn(() => jest.fn()) },
    } as any;
    const endTimer = jest.fn();
    service['inventoryKafkaMetrics'].kafkaReserveEventsDuration.startTimer.mockReturnValue(endTimer);
    // Patch logger
    service['logger'] = { error: jest.fn(), info: jest.fn() } as any;
    // Simulate event
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, { productId: 'p2', quantity: 100, price: 10 }, {});
    expect(service['inventoryKafkaMetrics'].kafkaReserveEventsFailed.inc).toHaveBeenCalledWith({ reason: 'reserveInventory_failed' });
    expect(service['inventoryKafkaMetrics'].kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'failed' });
    expect(endTimer).toHaveBeenCalledWith({ result: 'failed' });
    expect(service['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to reserve inventory for product p2 from Kafka event'),
      expect.anything(),
    );
  });

  it('should handle exception during reservation and increment metrics', async () => {
    // Arrange
    const mockReserveInventory = jest.spyOn(service, 'reserveInventory').mockRejectedValue(new Error('DB error'));
    service['inventoryKafkaMetrics'] = {
      kafkaReserveEventsFailed: { inc: jest.fn() },
      kafkaReserveEventsTotal: { inc: jest.fn() },
      kafkaReserveEventsDuration: { startTimer: jest.fn(() => jest.fn()) },
    } as any;
    const endTimer = jest.fn();
    service['inventoryKafkaMetrics'].kafkaReserveEventsDuration.startTimer.mockReturnValue(endTimer);
    service['logger'] = { error: jest.fn(), info: jest.fn() } as any;
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, { productId: 'p3', quantity: 1, price: 10 }, {});
    expect(service['inventoryKafkaMetrics'].kafkaReserveEventsFailed.inc).toHaveBeenCalledWith({ reason: 'exception' });
    expect(service['inventoryKafkaMetrics'].kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'failed' });
    expect(endTimer).toHaveBeenCalledWith({ result: 'failed' });
    expect(service['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Error reserving inventory for product p3 from Kafka event: DB error'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('should handle valid event and increment success metrics', async () => {
    // Arrange
    const mockReserveInventory = jest.spyOn(service, 'reserveInventory').mockResolvedValue({
      overallSuccess: true,
      orderId: 'kafka-1',
      reservationDetails: [{ productId: 'p1', reserved: true, reason: '', currentStock: 5 }],
    });
    service['inventoryKafkaMetrics'] = {
      kafkaReserveEventsFailed: { inc: jest.fn() },
      kafkaReserveEventsTotal: { inc: jest.fn() },
      kafkaReserveEventsDuration: { startTimer: jest.fn(() => jest.fn()) },
    } as any;
    const endTimer = jest.fn();
    service['inventoryKafkaMetrics'].kafkaReserveEventsDuration.startTimer.mockReturnValue(endTimer);
    service['logger'] = { error: jest.fn(), info: jest.fn() } as any;
    await service.onModuleInit();
    const handler = (kafkaConsumer.postSubscribeCallback as jest.Mock).mock.calls[0][0];
    await handler.handleMessage('reserveInventory', 0, { productId: 'p1', quantity: 2, price: 10, userId: 'u1', traceId: 'trace-1' }, {});
    expect(mockReserveInventory).toHaveBeenCalledWith({
      orderId: 'trace-1',
      userId: 'u1',
      itemsToReserve: [{ productId: 'p1', quantity: 2, price: 10 }],
    });
    expect(service['inventoryKafkaMetrics'].kafkaReserveEventsTotal.inc).toHaveBeenCalledWith({ result: 'success' });
    expect(endTimer).toHaveBeenCalledWith({ result: 'success' });
  });
});
