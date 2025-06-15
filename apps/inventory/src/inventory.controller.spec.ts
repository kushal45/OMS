import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ConfigService } from '@nestjs/config';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';
import { HttpStatus } from '@nestjs/common';
import { Inventory } from './entity/inventory.entity';
// Import gRPC request/response types if you want to type mockResolvedValues strictly
// For now, we'll use 'as any' or partial objects for mocks.
// import { ValidateInventoryReq, ValidateInventoryRes, ReserveInventoryReq, ReserveInventoryRes, ReleaseInventoryReq, ReleaseInventoryRes } from './proto/inventory.proto';

// Mocks
const mockInventoryService = {
  createInventory: jest.fn(),
  getInventories: jest.fn(),
  fetch: jest.fn(),
  delete: jest.fn(),
  validate: jest.fn(),
  reserveInventory: jest.fn(),
  releaseInventory: jest.fn(),
  eventBasedUpdate: jest.fn(), // if you need to test onModuleInit logic involving this
};

const mockConfigService = {
  get: jest.fn(),
};

const mockKafkaAdminClient = {
  createTopic: jest.fn(),
};

const mockKafkaConsumer = {
  subscribe: jest.fn(),
  postSubscribeCallback: jest.fn(),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockModuleRef = {
  get: jest.fn(),
};

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;
  let mockResponse: any;

  beforeEach(async () => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: KafkaAdminClient, useValue: mockKafkaAdminClient },
        { provide: 'KafkaConsumerInstance', useValue: mockKafkaConsumer }, // Assuming it's injected by this token
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('REST Endpoints', () => {
    describe('createInventory', () => {
      it('should create an inventory item', async () => {
        const inventoryData: Partial<Inventory> = { productId: 'prod-123', quantity: 100, location: 'A1' };
        const createdInventory = { id: 1, ...inventoryData } as Inventory;
        mockInventoryService.createInventory.mockResolvedValue(createdInventory);

        await controller.createInventory(inventoryData, mockResponse);

        expect(mockInventoryService.createInventory).toHaveBeenCalledWith(inventoryData);
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ data: createdInventory }));
      });
    });

    describe('getInventories', () => {
      it('should return all inventory items', async () => {
        const inventories = [{ id: 1, productId: 'prod-123', quantity: 100 }] as Inventory[];
        mockInventoryService.getInventories.mockResolvedValue(inventories);

        await controller.getInventories(mockResponse);

        expect(mockInventoryService.getInventories).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ data: inventories }));
      });
    });

    describe('getInventoryByProductId', () => {
      it('should return a specific inventory item by productId', async () => {
        const productId = 'prod-xyz';
        const inventory = { id: 1, productId, quantity: 50 } as Inventory;
        mockInventoryService.fetch.mockResolvedValue(inventory);

        await controller.getInventoryByProductId(productId, mockResponse);

        expect(mockInventoryService.fetch).toHaveBeenCalledWith(productId);
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ data: inventory }));
      });
    });

    describe('deleteInventory', () => {
      it('should delete an inventory item by productId', async () => {
        const productId = 'prod-to-delete';
        mockInventoryService.delete.mockResolvedValue(true);

        await controller.deleteInventory(productId, mockResponse);

        expect(mockInventoryService.delete).toHaveBeenCalledWith(productId);
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ data: true }));
      });
    });
  });

  describe('gRPC Methods', () => {
    const mockTraceId = 'grpc-trace-id';
    const mockGrpcMetadata = { get: () => [mockTraceId] }; // Simplified metadata mock

    describe('validate', () => {
      it('should call inventoryService.validate and return its result', async () => {
        const req = { orderItems: [{ productId: 'p1', quantity: 10, price: 100 }] } as any; // ValidateInventoryReq
        const res = { success: true, invalidOrderItems: [] } as any; // ValidateInventoryRes
        mockInventoryService.validate.mockResolvedValue(res);

        const result = await controller.validate(req); // Removed metadata for simplicity, gRPC handles it

        expect(mockInventoryService.validate).toHaveBeenCalledWith(req);
        expect(result).toEqual(res);
        expect(mockLoggerService.debug).toHaveBeenCalled();
      });

      it('should handle errors from inventoryService.validate', async () => {
        const req = { orderItems: [] } as any;
        const error = new Error('Validation failed');
        mockInventoryService.validate.mockRejectedValue(error);

        await expect(controller.validate(req)).rejects.toThrow(error);
        expect(mockLoggerService.error).toHaveBeenCalled();
      });
    });

    describe('reserveInventory', () => {
      it('should call inventoryService.reserveInventory and return its result', async () => {
        const req = { orderId: 'o1', userId: 'u1', itemsToReserve: [{ productId: 'p1', quantity: 5 }] } as any; // ReserveInventoryReq
        const res = { overallSuccess: true, orderId: 'o1', reservationDetails: [] } as any; // ReserveInventoryRes
        mockInventoryService.reserveInventory.mockResolvedValue(res);

        const result = await controller.reserveInventory(req);

        expect(mockInventoryService.reserveInventory).toHaveBeenCalledWith(req);
        expect(result).toEqual(res);
        expect(mockLoggerService.info).toHaveBeenCalledTimes(2); // Request and Response logs
      });
    });

    describe('releaseInventory', () => {
      it('should call inventoryService.releaseInventory and return its result', async () => {
        const req = { orderId: 'o1', itemsToRelease: [{ productId: 'p1', quantity: 5 }] } as any; // ReleaseInventoryReq
        const res = { overallSuccess: true, orderId: 'o1', releaseDetails: [] } as any; // ReleaseInventoryRes
        mockInventoryService.releaseInventory.mockResolvedValue(res);

        const result = await controller.releaseInventory(req);

        expect(mockInventoryService.releaseInventory).toHaveBeenCalledWith(req);
        expect(result).toEqual(res);
        expect(mockLoggerService.info).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('onModuleInit', () => {
    it('should create Kafka topic and subscribe consumer', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'INVENTORY_UPDATE_TOPIC') return 'inventory-updates';
        return null;
      });
      mockKafkaAdminClient.createTopic.mockResolvedValue(undefined);
      mockKafkaConsumer.subscribe.mockResolvedValue(undefined);
      mockInventoryService.eventBasedUpdate.mockResolvedValue(undefined); // Ensure this is mocked if called

      await controller.onModuleInit();

      expect(mockKafkaAdminClient.createTopic).toHaveBeenCalledWith('inventory-updates');
      expect(mockKafkaConsumer.subscribe).toHaveBeenCalledWith('inventory-updates');
      expect(mockInventoryService.eventBasedUpdate).toHaveBeenCalledWith(mockKafkaConsumer);
    });
  });
});
