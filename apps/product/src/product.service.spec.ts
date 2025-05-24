import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { ProductService } from './product.service';
import { ProductRepository } from './repository/product.repository';
import { Product } from './entity/product.entity';

// Centralized Test DB Utilities
import GlobalTestOrmConfigService from '@lib/test-utils/src/orm.config.test';
import { initializeDatabase } from '@lib/test-utils/src/test-db-setup.util';

describe('ProductService', () => {
  let service: ProductService;
  let dataSource: DataSource;
  let productRepository: ProductRepository; // Custom repository
  let rawProductRepository: Repository<Product>; // For direct DB interaction/verification

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: GlobalTestOrmConfigService,
          dataSourceFactory: async (options) => new DataSource(options),
        }),
        TypeOrmModule.forFeature([Product]),
      ],
      providers: [
        ProductService,
        ProductRepository, // Provide the custom repository
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    dataSource = module.get<DataSource>(DataSource);
    productRepository = module.get<ProductRepository>(ProductRepository);
    rawProductRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  beforeEach(async () => {
    await initializeDatabase(dataSource);
    // jest.clearAllMocks(); // No mocks to clear for this service yet
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('should create and return a product', async () => {
      const productData = { name: 'Test Product', price: 10.99, description: 'A test product' };
      const createdProduct = await service.createProduct(productData);
      
      expect(createdProduct).toBeDefined();
      expect(createdProduct.id).toBeDefined();
      expect(createdProduct.name).toEqual(productData.name);
      expect(createdProduct.price).toEqual(productData.price);

      const dbProduct = await rawProductRepository.findOneBy({ id: createdProduct.id });
      expect(dbProduct).toBeDefined();
      expect(dbProduct.name).toEqual(productData.name);
    });
  });

  describe('getProducts', () => {
    it('should return an array of products', async () => {
      await rawProductRepository.save([
        rawProductRepository.create({ name: 'Product 1', price: 10, description: 'Desc 1' }),
        rawProductRepository.create({ name: 'Product 2', price: 20, description: 'Desc 2' }),
      ]);
      const products = await service.getProducts();
      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBe(2);
    });

    it('should return an empty array if no products exist', async () => {
      const products = await service.getProducts();
      expect(products).toEqual([]);
    });
  });

  describe('getProductById', () => {
    it('should return a product if found', async () => {
      const savedProduct = await rawProductRepository.save(
        rawProductRepository.create({ name: 'Find Me', price: 15, description: 'I can be found' })
      );
      const foundProduct = await service.getProductById(savedProduct.id);
      expect(foundProduct).toBeDefined();
      expect(foundProduct.id).toEqual(savedProduct.id);
      expect(foundProduct.name).toEqual('Find Me');
    });

    it('should return null or throw NotFoundException if product not found (depending on repository implementation)', async () => {
      // Assuming repository's findOne returns null if not found, and service doesn't add specific error handling
      // If ProductRepository.findOne is expected to throw NotFoundException, adjust this test.
      const product = await service.getProductById(999);
      expect(product).toBeNull(); 
      // OR: await expect(service.getProductById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProduct', () => {
    it('should update and return the product', async () => {
      const savedProduct = await rawProductRepository.save(
        rawProductRepository.create({ name: 'Old Name', price: 25, description: 'Old Desc' })
      );
      const updateData = { name: 'New Name', price: 30 };
      const updatedProduct = await service.updateProduct(savedProduct.id, updateData);

      expect(updatedProduct).toBeDefined();
      expect(updatedProduct.name).toEqual('New Name');
      expect(updatedProduct.price).toEqual(30);

      const dbProduct = await rawProductRepository.findOneBy({ id: savedProduct.id });
      expect(dbProduct.name).toEqual('New Name');
    });

    it('should return null or throw if product to update is not found (depending on repository)', async () => {
      // Assuming repository's update might return an object indicating no rows affected, or throw.
      // ProductService.updateProduct directly returns repository result.
      // If ProductRepository.update is expected to throw NotFoundException for non-existent ID, adjust.
      const result = await service.updateProduct(999, { name: 'Non Existent' });
      // This expectation depends heavily on what ProductRepository.update returns for non-existent ID.
      // It might return an UpdateResult object, or the entity if found and updated, or throw.
      // For now, let's assume it might return null or the entity if TypeORM's save/update is used with an ID.
      // If it's a custom method that returns the entity or throws, this needs adjustment.
      // Let's assume for now it might return null if not found by the update operation.
      expect(result).toBeNull(); // Or check for specific error if repository throws
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product and return true', async () => {
      const savedProduct = await rawProductRepository.save(
        rawProductRepository.create({ name: 'To Delete', price: 5, description: 'Delete me' })
      );
      const result = await service.deleteProduct(savedProduct.id);
      expect(result).toBe(true);

      const dbProduct = await rawProductRepository.findOneBy({ id: savedProduct.id });
      expect(dbProduct).toBeNull();
    });

    it('should return false if product to delete is not found', async () => {
      const result = await service.deleteProduct(999);
      expect(result).toBe(false); // Assuming repository's delete returns boolean success
    });
  });
});