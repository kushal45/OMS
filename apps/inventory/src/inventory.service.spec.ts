import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';
import { Inventory } from './entity/inventory.entity';
import { QueryInput } from './interfaces/query-input.interface';
import { ValidateInventoryReq, ValidateInventoryRes, ReserveInventoryReq, ReserveInventoryRes, ReleaseInventoryReq, ReleaseInventoryRes, OrderItem as ProtoOrderItem, ReservationStatus, ReleaseStatus } from './proto/inventory.proto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CheckProductIdHandler } from './util/check-product-id-handler';
import { CheckQuantityHandler } from './util/check-quantity-handler';

// Mocks
const mockInventoryRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByProductId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getRepository: jest.fn().mockReturnThis(), // For transactional context
  // TypeORM methods (if used directly on this mock)
  save: jest.fn(),
  findOne: jest.fn(),
  createEntity: jest.fn(), // if repository has a method like this instead of TypeORM's .create()
};

const mockTransactionService = {
  executeInTransaction: jest.fn(async (callback) => callback(mockEntityManager)),
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

const mockEntityManager = {
  getRepository: jest.fn().mockReturnValue(mockInventoryRepository), // Mock to return the inventory repo mock
} as unknown as EntityManager;

// Mock for CheckProductIdHandler and CheckQuantityHandler
jest.mock('./util/check-product-id-handler');
jest.mock('./util/check-quantity-handler');
const mockCheckProductIdHandlerInstance = {
    handle: jest.fn(),
    setNext: jest.fn(),
};
const mockCheckQuantityHandlerInstance = {
    handle: jest.fn(),
    setNext: jest.fn(), // Though it might not have a next
};
(CheckProductIdHandler as jest.Mock).mockImplementation(() => mockCheckProductIdHandlerInstance);
(CheckQuantityHandler as jest.Mock).mockImplementation(() => mockCheckQuantityHandlerInstance);


describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: mockInventoryRepository },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();

    // Ensure getRepository on the mockInventoryRepository itself returns the mock for transactional calls
    mockInventoryRepository.getRepository.mockReturnValue(mockInventoryRepository as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const productId1 = 'prod-uuid-1';
  const productId2 = 'prod-uuid-2';

  describe('validate', () => {
    it('should return success true if all items are valid', async () => {
      const req: ValidateInventoryReq = {
        orderItems: [{ productId: productId1, quantity: 5, price: 10 }],
      };
      const mockInventories: Inventory[] = [
        { id: 1, productId: productId1, quantity: 10, reservedQuantity: 0, location: 'A1', status: QueryInput.InventoryStatus.IN_STOCK, product: null },
      ];
      mockInventoryRepository.findAll.mockResolvedValue(mockInventories);
      mockCheckProductIdHandlerInstance.handle.mockReturnValue([]); // No reasons = valid

      const result = await service.validate(req);
      expect(result.success).toBe(true);
      expect(result.invalidOrderItems.length).toBe(0);
      expect(mockInventoryRepository.findAll).toHaveBeenCalledWith({
        productId: [productId1],
        status: QueryInput.InventoryStatus.IN_STOCK,
      });
    });

    it('should return success false with invalid items if validation fails', async () => {
      const req: ValidateInventoryReq = {
        orderItems: [{ productId: productId1, quantity: 15, price: 10 }],
      };
      const mockInventories: Inventory[] = [
        { id: 1, productId: productId1, quantity: 10, reservedQuantity: 0, location: 'A1', status: QueryInput.InventoryStatus.IN_STOCK, product: null },
      ];
      mockInventoryRepository.findAll.mockResolvedValue(mockInventories);
      mockCheckProductIdHandlerInstance.handle.mockReturnValue(['INSUFFICIENT_STOCK']); // Example reason

      const result = await service.validate(req);
      expect(result.success).toBe(false);
      expect(result.invalidOrderItems.length).toBe(1);
      expect(result.invalidOrderItems[0].orderItem.productId).toBe(productId1);
      expect(result.invalidOrderItems[0].reasons).toEqual(['INSUFFICIENT_STOCK']);
    });
  });

  describe('fetch', () => {
    it('should return inventory if found', async () => {
      const inventory = { id: 1, productId: productId1, quantity: 10 } as Inventory;
      mockInventoryRepository.findByProductId.mockResolvedValue(inventory);
      const result = await service.fetch(productId1);
      expect(result).toEqual(inventory);
    });

    it('should throw NotFoundException if inventory not found', async () => {
      mockInventoryRepository.findByProductId.mockResolvedValue(null);
      await expect(service.fetch(productId1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reserveInventory', () => {
    const orderId = 'order-123';
    const userId = 'user-456';

    it('should reserve inventory successfully if stock is sufficient', async () => {
      const req: ReserveInventoryReq = {
        orderId, userId,
        itemsToReserve: [{ productId: productId1, quantity: 5, price: 0 }],
      };
      const inventoryP1 = { id: 1, productId: productId1, quantity: 10, reservedQuantity: 0, status: QueryInput.InventoryStatus.IN_STOCK } as Inventory;
      mockInventoryRepository.findOne.mockResolvedValue(inventoryP1); // Mock for findOne used by getRepository(entityManager).findOne
      mockInventoryRepository.save.mockImplementation(inv => Promise.resolve(inv as Inventory)); // Mock for save

      const result = await service.reserveInventory(req);

      expect(mockTransactionService.executeInTransaction).toHaveBeenCalled();
      expect(result.overallSuccess).toBe(true);
      expect(result.reservationDetails.length).toBe(1);
      expect(result.reservationDetails[0].productId).toBe(productId1);
      expect(result.reservationDetails[0].reserved).toBe(true);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        productId: productId1,
        quantity: 5, // 10 - 5
        reservedQuantity: 5,
      }));
    });

    it('should fail reservation if product not found', async () => {
      const req: ReserveInventoryReq = {
        orderId, userId,
        itemsToReserve: [{ productId: 'unknown-prod', quantity: 5, price: 0 }],
      };
      mockInventoryRepository.findOne.mockResolvedValue(null);

      const result = await service.reserveInventory(req);
      expect(result.overallSuccess).toBe(false);
      expect(result.reservationDetails[0].reason).toBe('PRODUCT_NOT_FOUND');
    });

    it('should fail reservation if stock is insufficient', async () => {
      const req: ReserveInventoryReq = {
        orderId, userId,
        itemsToReserve: [{ productId: productId1, quantity: 15, price: 0 }],
      };
      const inventoryP1 = { id: 1, productId: productId1, quantity: 10, reservedQuantity: 0 } as Inventory;
      mockInventoryRepository.findOne.mockResolvedValue(inventoryP1);

      const result = await service.reserveInventory(req);
      expect(result.overallSuccess).toBe(false);
      expect(result.reservationDetails[0].reason).toBe('INSUFFICIENT_STOCK');
      expect(mockInventoryRepository.save).not.toHaveBeenCalled(); // Transaction should rollback
    });

    it('should handle partial success/failure correctly (rollback)', async () => {
        const req: ReserveInventoryReq = {
            orderId, userId,
            itemsToReserve: [
                { productId: productId1, quantity: 5, price: 0 }, // Will succeed initially
                { productId: productId2, quantity: 20, price: 0 } // Will fail
            ],
        };
        const inventoryP1 = { id: 1, productId: productId1, quantity: 10, reservedQuantity: 0, status: QueryInput.InventoryStatus.IN_STOCK } as Inventory;
        const inventoryP2 = { id: 2, productId: productId2, quantity: 10, reservedQuantity: 0, status: QueryInput.InventoryStatus.IN_STOCK } as Inventory;

        mockInventoryRepository.findOne.mockImplementation(async ({where}: any) => {
            if (where.productId === productId1) return inventoryP1;
            if (where.productId === productId2) return inventoryP2;
            return null;
        });
        mockInventoryRepository.save.mockImplementation(inv => Promise.resolve(inv as Inventory));

        const result = await service.reserveInventory(req);
        expect(result.overallSuccess).toBe(false);
        expect(result.reservationDetails.find(d => d.productId === productId1).reserved).toBe(false); // Due to rollback
        expect(result.reservationDetails.find(d => d.productId === productId2).reason).toBe('INSUFFICIENT_STOCK');
        // Save for P1 might have been called inside transaction, but transaction rolls back.
    });
  });

  describe('releaseInventory', () => {
    const orderId = 'order-789';
    it('should release inventory successfully', async () => {
      const req: ReleaseInventoryReq = {
        orderId,
        itemsToRelease: [{ productId: productId1, quantity: 3, price: 0 }],
      };
      const inventoryP1 = { id: 1, productId: productId1, quantity: 5, reservedQuantity: 5, status: QueryInput.InventoryStatus.IN_STOCK } as Inventory;
      mockInventoryRepository.findOne.mockResolvedValue(inventoryP1);
      mockInventoryRepository.save.mockImplementation(inv => Promise.resolve(inv as Inventory));

      const result = await service.releaseInventory(req);
      expect(result.overallSuccess).toBe(true);
      expect(result.releaseDetails[0].released).toBe(true);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        productId: productId1,
        quantity: 8, // 5 + 3
        reservedQuantity: 2, // 5 - 3
      }));
    });

    it('should fail release if trying to release more than reserved', async () => {
      const req: ReleaseInventoryReq = {
        orderId,
        itemsToRelease: [{ productId: productId1, quantity: 10, price: 0 }],
      };
      const inventoryP1 = { id: 1, productId: productId1, quantity: 5, reservedQuantity: 5 } as Inventory;
      mockInventoryRepository.findOne.mockResolvedValue(inventoryP1);

      const result = await service.releaseInventory(req);
      expect(result.overallSuccess).toBe(false);
      expect(result.releaseDetails[0].reason).toBe('RELEASE_EXCEEDS_RESERVATION');
    });
  });

  describe('delete', () => {
    it('should delete inventory if found', async () => {
        const inventory = { id: 1, productId: productId1 } as Inventory;
        mockInventoryRepository.findByProductId.mockResolvedValue(inventory);
        mockInventoryRepository.delete.mockResolvedValue(true);
        const result = await service.delete(productId1);
        expect(result).toBe(true);
        expect(mockInventoryRepository.delete).toHaveBeenCalledWith(inventory.id);
    });
    it('should throw NotFound if inventory to delete is not found', async () => {
        mockInventoryRepository.findByProductId.mockResolvedValue(null);
        await expect(service.delete(productId1)).rejects.toThrow(NotFoundException);
    });
  });

  // eventBasedUpdate is harder to test without a live Kafka consumer or more intricate mocking of its callback logic.
  // Basic test could check if postSubscribeCallback is called.
});