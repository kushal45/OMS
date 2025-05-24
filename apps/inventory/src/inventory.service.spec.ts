import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';

import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repository/inventory.repository';
import { Inventory } from './entity/inventory.entity'; // Removed InventoryStatus from here
import { Product } from '@app/product/src/entity/product.entity'; // Assuming Product entity is needed for context
import { ValidateOrderItemsReqDto } from './dto/validate-order-items-req.dto';
import { ValidateOrderItemsResponseDto } from './dto/validate-order-items-res.dto';
import { QueryInput } from './interfaces/query-input.interface'; // QueryInput contains InventoryStatus


// Centralized Test DB Utilities
import GlobalTestOrmConfigService from '@lib/test-utils/src/orm.config.test';
import { initializeDatabase } from '@lib/test-utils/src/test-db-setup.util';

describe('InventoryService', () => {
  let service: InventoryService;
  let dataSource: DataSource;
  let inventoryRepository: InventoryRepository;
  let rawInventoryRepository: Repository<Inventory>;
  let rawProductRepository: Repository<Product>; // For creating test products

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: GlobalTestOrmConfigService,
          dataSourceFactory: async (options) => new DataSource(options),
        }),
        TypeOrmModule.forFeature([Inventory, Product]), // Include Product if creating products for tests
      ],
      providers: [
        InventoryService,
        InventoryRepository,
        // ModuleRef is usually provided by NestJS itself.
        // If specific providers are resolved via moduleRef in the service,
        // they might need to be mocked or provided here if not part of the testing module.
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    dataSource = module.get<DataSource>(DataSource);
    inventoryRepository = module.get<InventoryRepository>(InventoryRepository);
    rawInventoryRepository = module.get<Repository<Inventory>>(getRepositoryToken(Inventory));
    rawProductRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  beforeEach(async () => {
    await initializeDatabase(dataSource);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInventory', () => {
    it('should create and return an inventory item', async () => {
      const product = await rawProductRepository.save(rawProductRepository.create({ name: 'Stocked Product', price: 50, description: 'In stock' }));
      const inventoryData: Partial<Inventory> = { productId: product.id, quantity: 100, status: QueryInput.InventoryStatus.IN_STOCK }; // Used QueryInput.InventoryStatus
      const createdInventory = await service.createInventory(inventoryData);

      expect(createdInventory).toBeDefined();
      expect(createdInventory.id).toBeDefined();
      expect(createdInventory.productId).toEqual(product.id);
      expect(createdInventory.quantity).toEqual(100);

      const dbInventory = await rawInventoryRepository.findOneBy({ id: createdInventory.id });
      expect(dbInventory).toBeDefined();
      expect(dbInventory.quantity).toEqual(100);
    });
  });

  describe('getInventories', () => {
    it('should return an array of inventory items', async () => {
      const product1 = await rawProductRepository.save(rawProductRepository.create({ name: 'Inv Prod 1', price: 10 }));
      const product2 = await rawProductRepository.save(rawProductRepository.create({ name: 'Inv Prod 2', price: 20 }));
      await rawInventoryRepository.save([
        rawInventoryRepository.create({ productId: product1.id, quantity: 10, status: QueryInput.InventoryStatus.IN_STOCK }), // Used QueryInput.InventoryStatus
        rawInventoryRepository.create({ productId: product2.id, quantity: 5, status: QueryInput.InventoryStatus.IN_STOCK }), // Used QueryInput.InventoryStatus
      ]);
      const inventories = await service.getInventories();
      expect(inventories).toBeInstanceOf(Array);
      expect(inventories.length).toBe(2);
    });
  });

  describe('validate', () => {
    let product1: Product;
    let product2: Product;
    let product3: Product;

    beforeEach(async () => {
      product1 = await rawProductRepository.save(rawProductRepository.create({ name: 'P1 Valid', price: 10 }));
      product2 = await rawProductRepository.save(rawProductRepository.create({ name: 'P2 Low Stock', price: 20 }));
      product3 = await rawProductRepository.save(rawProductRepository.create({ name: 'P3 Out of Stock', price: 30 }));

      await rawInventoryRepository.save(rawInventoryRepository.create({ productId: product1.id, quantity: 10, status: QueryInput.InventoryStatus.IN_STOCK })); // Used QueryInput.InventoryStatus
      await rawInventoryRepository.save(rawInventoryRepository.create({ productId: product2.id, quantity: 3, status: QueryInput.InventoryStatus.IN_STOCK })); // Used QueryInput.InventoryStatus
      await rawInventoryRepository.save(rawInventoryRepository.create({ productId: product3.id, quantity: 0, status: QueryInput.InventoryStatus.OUT_OF_STOCK })); // Used QueryInput.InventoryStatus
    });

    it('should return success:true if all items are valid and in stock', async () => {
      const reqDto: ValidateOrderItemsReqDto = {
        orderItems: [
          { productId: product1.id, quantity: 5, price: 10 },
        ],
      };
      const response = await service.validate(reqDto);
      expect(response.success).toBe(true);
      expect(response.invalidOrderItems).toBeUndefined();
    });

    it('should return success:false with reasons if an item has insufficient quantity', async () => {
      const reqDto: ValidateOrderItemsReqDto = {
        orderItems: [
          { productId: product1.id, quantity: 5, price: 10 }, // Valid
          { productId: product2.id, quantity: 5, price: 20 }, // Insufficient stock (available: 3, requested: 5)
        ],
      };
      const response = await service.validate(reqDto);
      expect(response.success).toBe(false);
      expect(response.invalidOrderItems).toBeDefined();
      expect(response.invalidOrderItems.length).toBe(1);
      expect(response.invalidOrderItems[0].orderItem.productId).toEqual(product2.id);
      // The exact reason message depends on the implementation of CheckQuantityHandler and CheckProductIdHandler
      // For now, we just check that there's an invalid item.
    });

    it('should return success:false with reasons if an item is not found in inventory (or out of stock status)', async () => {
      const productNotInInventory = await rawProductRepository.save(rawProductRepository.create({ name: 'P4 Not In Inv', price: 40 }));
      const reqDto: ValidateOrderItemsReqDto = {
        orderItems: [
          { productId: productNotInInventory.id, quantity: 1, price: 40 }, // Not in inventory table
        ],
      };
      const response = await service.validate(reqDto);
      expect(response.success).toBe(false);
      expect(response.invalidOrderItems).toBeDefined();
      expect(response.invalidOrderItems.length).toBe(1);
      expect(response.invalidOrderItems[0].orderItem.productId).toEqual(productNotInInventory.id);
    });
    
    it('should return success:false with reasons if an item is explicitly out of stock', async () => {
        const reqDto: ValidateOrderItemsReqDto = {
          orderItems: [
            { productId: product3.id, quantity: 1, price: 30 }, // Explicitly OUT_OF_STOCK
          ],
        };
        const response = await service.validate(reqDto);
        expect(response.success).toBe(false);
        expect(response.invalidOrderItems).toBeDefined();
        expect(response.invalidOrderItems.length).toBe(1);
        expect(response.invalidOrderItems[0].orderItem.productId).toEqual(product3.id);
      });

    it('should handle a mix of valid, insufficient, and not found items', async () => {
      const productNotInInventory = await rawProductRepository.save(rawProductRepository.create({ name: 'P5 Not In Inv Mix', price: 50 }));
      const reqDto: ValidateOrderItemsReqDto = {
        orderItems: [
          { productId: product1.id, quantity: 2, price: 10 }, // Valid
          { productId: product2.id, quantity: 10, price: 20 }, // Insufficient
          { productId: productNotInInventory.id, quantity: 1, price: 50 }, // Not found
          { productId: product3.id, quantity: 1, price: 30 }, // Out of stock status
        ],
      };
      const response = await service.validate(reqDto);
      expect(response.success).toBe(false);
      expect(response.invalidOrderItems).toBeDefined();
      expect(response.invalidOrderItems.length).toBe(3); // product2, productNotInInventory, product3

      const invalidProductIds = response.invalidOrderItems.map(item => item.orderItem.productId);
      expect(invalidProductIds).toContain(product2.id);
      expect(invalidProductIds).toContain(productNotInInventory.id);
      expect(invalidProductIds).toContain(product3.id);
    });

    it('should return success:true for an empty orderItems array (or handle as per business logic)', async () => {
        // Current service implementation of validate() will likely process an empty array.
        // If business logic dictates an empty orderItems array is invalid, the service should throw an error.
        // The test reflects current behavior based on the snippet.
        const reqDto: ValidateOrderItemsReqDto = {
          orderItems: [],
        };
        const response = await service.validate(reqDto);
        expect(response.success).toBe(true); // Because no items fail validation
        expect(response.invalidOrderItems).toBeUndefined();
      });
  });
});