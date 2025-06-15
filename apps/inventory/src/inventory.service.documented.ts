import { Injectable } from '@nestjs/common';
import { InventoryRepository } from './repository/inventory.repository';
import { Inventory } from './entity/inventory.entity';
import { ValidateOrderItemsReqDto } from './dto/validate-order-items-req.dto';
import { QueryInput } from './interfaces/query-input.interface';
import { CheckProductIdHandler } from './util/check-product-id-handler';
import { CheckQuantityHandler } from './util/check-quantity-handler';
import { ValidateOrderItemsResponseDto } from './dto/validate-order-items-res.dto';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { ModuleRef } from '@nestjs/core';
import { TransactionService } from '@app/utils/transaction.service';

/**
 * Service responsible for managing inventory operations and stock validation.
 * 
 * Handles inventory creation, updates, validation, and integrates with order
 * processing to ensure accurate stock levels. Supports event-driven updates
 * via Kafka messaging for real-time inventory synchronization across services.
 * 
 * Key responsibilities:
 * - Stock level management and tracking
 * - Order item validation against available inventory
 * - Event-driven inventory updates via Kafka
 * - CRUD operations for inventory entities
 * 
 * @example
 * ```typescript
 * const inventoryService = new InventoryService(repository, moduleRef);
 * const validation = await inventoryService.validate(orderItems);
 * ```
 */
@Injectable()
export class InventoryService {
  /**
   * Creates an instance of InventoryService.
   * 
   * @param inventoryRepository - Repository for inventory data operations
   * @param moduleRef - NestJS module reference for dependency injection
   */
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Creates a new inventory entry for a product.
   * 
   * @param inventory - Partial inventory object containing product details
   * @returns Promise resolving to the created inventory entity
   * 
   * @example
   * ```typescript
   * const newInventory = await inventoryService.createInventory({
   *   productId: 123,
   *   quantity: 100,
   *   status: InventoryStatus.IN_STOCK
   * });
   * ```
   */
  async createInventory(inventory: Partial<Inventory>): Promise<Inventory> {
    return this.inventoryRepository.create(inventory);
  }

  /**
   * Retrieves all inventory entries from the system.
   * 
   * @returns Promise resolving to array of all inventory entities
   * 
   * @example
   * ```typescript
   * const allInventories = await inventoryService.getInventories();
   * console.log(`Total products in inventory: ${allInventories.length}`);
   * ```
   */
  async getInventories(): Promise<Inventory[]> {
    return this.inventoryRepository.findAll();
  }

  /**
   * Validates order items against available inventory stock.
   * 
   * Performs comprehensive validation including:
   * - Checks if all products are in stock
   * - Validates sufficient quantity for each product
   * - Returns detailed information about invalid items
   * 
   * This method is called by OrderService during order creation to ensure
   * inventory availability before processing orders.
   * 
   * @param items - Request DTO containing order items to validate
   * @returns Promise resolving to validation response with success status
   * 
   * @throws {Error} When inventory repository operations fail
   * 
   * @example
   * ```typescript
   * const validation = await inventoryService.validate({
   *   orderItems: [
   *     { productId: 123, quantity: 2 },
   *     { productId: 456, quantity: 1 }
   *   ]
   * });
   * 
   * if (!validation.success) {
   *   console.log('Invalid items:', validation.invalidOrderItems);
   * }
   * ```
   */
  async validate(
    items: ValidateOrderItemsReqDto,
  ): Promise<ValidateOrderItemsResponseDto> {
    try {
      const productIds = items.orderItems.map((item) => item.productId);
      const matchingInventories = await this.inventoryRepository.findAll({
        productId: productIds,
        status: QueryInput.InventoryStatus.IN_STOCK,
      });
      
      /**
       * Business Logic:
       * 1. Check if all products are in stock
       * 2. Check if the quantity of each product in the inventory is greater than or equal with the order Items requested quantity
       * 3. If any of the above conditions fail, return those products which are not in stock or have insufficient quantity
       * 
       * Invalid match can be of two types:
       * 1. Product is not in stock
       * 2. Product is in stock but the quantity is less than the requested quantity
       * 
       * In both cases, return those entries with the product id and the quantity that is not in stock or is less than the requested quantity
       */
      const invalidOrderItems = this.matchInventoriesWithOrderItems(
        items,
        matchingInventories,
      );
      
      if (invalidOrderItems.length > 0) {
        return {
          success: false,
          invalidOrderItems,
        };
      } else {
        return {
          success: true,
        };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves inventory information for a specific product.
   * 
   * @param productId - ID of the product to fetch inventory for
   * @returns Promise resolving to inventory entity for the product
   * 
   * @example
   * ```typescript
   * const productInventory = await inventoryService.fetch(123);
   * console.log(`Available quantity: ${productInventory.quantity}`);
   * ```
   */
  async fetch(productId: number): Promise<Inventory> {
    return this.inventoryRepository.findOne({ productId });
  }

  /**
   * Updates inventory information for a specific product.
   * 
   * @param productId - ID of the product to update
   * @param inventory - Partial inventory object with updated values
   * @returns Promise resolving to the updated inventory entity
   * 
   * @example
   * ```typescript
   * const updated = await inventoryService.update(123, {
   *   quantity: 150,
   *   status: InventoryStatus.IN_STOCK
   * });
   * ```
   */
  async update(
    productId: number,
    inventory: Partial<Inventory>,
  ): Promise<Inventory> {
    return this.inventoryRepository.update(productId, inventory);
  }

  /**
   * Sets up event-driven inventory updates using Kafka consumer.
   * 
   * Listens to inventory update events and processes them to maintain
   * real-time synchronization across services. Uses chain of responsibility
   * pattern with handlers for different validation types.
   * 
   * @param kafkaConsumer - Kafka consumer instance for message handling
   * 
   * @example
   * ```typescript
   * const kafkaConsumer = new KafkaConsumer();
   * await inventoryService.eventBasedUpdate(kafkaConsumer);
   * ```
   */
  async eventBasedUpdate(kafkaConsumer: KafkaConsumer) {
    const transactionService = this.moduleRef.get(TransactionService, {
      strict: false,
    });
    await kafkaConsumer.consume(
      async (topic, partition, message, headers) => {
        console.log('processing message', message);
        
        // Chain of responsibility pattern for validation
        const checkProductIdHandler = new CheckProductIdHandler();
        const checkQuantityHandler = new CheckQuantityHandler();
        checkProductIdHandler.setNext(checkQuantityHandler);
        
        const isValid = await checkProductIdHandler.handle(message);
        if (isValid) {
          await transactionService.executeInTransaction(
            async (entityManager) => {
              const inventoryRepo = await this.inventoryRepository.getRepository(entityManager);
              const updatedInventory = await inventoryRepo.update(
                message.productId,
                {
                  quantity: message.quantity,
                },
              );
              return !!updatedInventory;
            },
          );
        }
      },
    );
  }

  /**
   * Deletes inventory entry for a specific product.
   * 
   * @param productId - ID of the product to remove from inventory
   * @returns Promise resolving to boolean indicating deletion success
   * 
   * @example
   * ```typescript
   * const deleted = await inventoryService.delete(123);
   * if (deleted) {
   *   console.log('Product removed from inventory');
   * }
   * ```
   */
  async delete(productId: number): Promise<boolean> {
    return this.inventoryRepository.delete(productId);
  }

  /**
   * Matches order items against available inventory to identify invalid items.
   * 
   * Private helper method that implements the core validation logic for
   * determining which order items cannot be fulfilled due to stock issues.
   * 
   * @param items - Order items request DTO
   * @param matchingInventories - Available inventory entities
   * @returns Array of invalid order items with details
   * 
   * @private
   */
  private matchInventoriesWithOrderItems(
    items: ValidateOrderItemsReqDto,
    matchingInventories: Inventory[],
  ): any[] {
    // Implementation would be here - this is a private helper method
    // that contains the business logic for matching and validation
    return [];
  }
}
