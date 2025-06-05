import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Inject } from '@nestjs/common';
import { InventoryRepository } from './repository/inventory.repository';
import { Inventory } from './entity/inventory.entity';
// ValidateOrderItemsReqDto and ValidateOrderItemsResponseDto are no longer used directly by the service's public validate method.
// They might still be used internally or by REST endpoints if those exist and differ from gRPC.
// For gRPC, we use types from proto.
import { QueryInput } from './interfaces/query-input.interface';
import { CheckProductIdHandler } from './util/check-product-id-handler';
import { CheckQuantityHandler } from './util/check-quantity-handler';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { ModuleRef } from '@nestjs/core'; // Keep if used for other dynamic resolutions
import { TransactionService } from '@app/utils/transaction.service';
import {
  ReserveInventoryReq,
  ReserveInventoryRes,
  ReleaseInventoryReq,
  ReleaseInventoryRes,
  ReservationStatus,
  ReleaseStatus,
  OrderItem as ProtoOrderItem,
  ValidateInventoryReq,
  ValidateInventoryRes
} from './proto/inventory'; // Import gRPC request/response types
import { EntityManager } from 'typeorm';
import { LoggerService } from '@lib/logger/src';
import { ReserveInventoryHandler } from './kafka-handlers/reserve-inventory.handler';
import { ConfigService } from '@nestjs/config';
import { ReleaseInventoryHandler } from './kafka-handlers/release-inventory.handler';
import { ReplenishInventoryHandler } from './kafka-handlers/replenish-inventory.handler'; // Import for the new handler

// Define the structure of the items for replenishment payload
interface ReplenishItem {
  productId: string; // Assuming productId will be string here
  quantity: number;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly loggerContext = InventoryService.name;

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly transactionService: TransactionService,
    private readonly logger: LoggerService,
    @Inject('KafkaConsumerInstance') private readonly kafkaConsumer: KafkaConsumer,
    private readonly moduleRef: ModuleRef, // Keep if used for dynamic resolution of handlers
    private readonly configService: ConfigService,
  ) {}

  private topicHandlerConfig: Array<{ topicKey: string; handlerClass: any; topicName?: string }> = [
    { topicKey: 'RESERVE_INVENTORY_TOPIC', handlerClass: ReserveInventoryHandler },
    { topicKey: 'RELEASE_INVENTORY_TOPIC', handlerClass: ReleaseInventoryHandler },
    { topicKey: 'REPLENISH_INVENTORY_TOPIC', handlerClass: ReplenishInventoryHandler },
  ];

  async onModuleInit() {
    if (!(this.kafkaConsumer as any)._subscribedTopics) {
      (this.kafkaConsumer as any)._subscribedTopics = {};
    }
    const activeTopicToHandlerMap = new Map<string, any>();
    // Resolve topic names and subscribe
    for (const config of this.topicHandlerConfig) {
      config.topicName = this.configService.get<string>(config.topicKey);
      if (!config.topicName) {
        this.logger.error(`Kafka topic key ${config.topicKey} not found in configuration. Skipping subscription.`, this.loggerContext);
        continue;
      }
      if (!(this.kafkaConsumer as any)._subscribedTopics[config.topicName]) {
        await this.kafkaConsumer.subscribe(config.topicName);
        activeTopicToHandlerMap.set(config.topicName, config.handlerClass);
        (this.kafkaConsumer as any)._subscribedTopics[config.topicName] = true;
        this.logger.info(`Subscribed to Kafka topic: ${config.topicName} (from key ${config.topicKey})`, this.loggerContext);
      }
    }

    await this.kafkaConsumer.postSubscribeCallback({
      handleMessage: async (topic, partition, message, headers) => {
        this.logger.debug(`Received message on topic: ${topic}, partition: ${partition}`, this.loggerContext);
        const handlerClass = activeTopicToHandlerMap.get(topic);
        if (handlerClass) {
          try {
            const handlerInstance = await this.moduleRef.get(handlerClass, { strict: false });
            await handlerInstance.handleMessage(topic, partition, message, headers);
          } catch (error) {
            this.logger.error(`Error obtaining or executing handler for topic ${topic}: ${error.message}`, error.stack, this.loggerContext);
            // Potentially re-throw or handle more gracefully depending on desired behavior for handler resolution/execution errors
          }
        } else {
          this.logger.info(`No configured handler for Kafka topic: ${topic}`, this.loggerContext);
        }
      }
    });
  }

  async createInventory(inventory: Partial<Inventory>): Promise<Inventory> {
    return this.inventoryRepository.create(inventory);
  }

  async getInventories(): Promise<Inventory[]> {
    return this.inventoryRepository.findAll();
  }

  async validate(
    req: ValidateInventoryReq, // Changed to use gRPC request type
  ): Promise<ValidateInventoryRes> { // Changed to use gRPC response type
    try {
      // The items are now in req.orderItems, which should be an array of ProtoOrderItem
      const productIds = req.orderItems.map((item) => item.productId);
      const matchingInventories = await this.inventoryRepository.findAll({
        productId: productIds, // This is already string[] from ProtoOrderItem
        status: QueryInput.InventoryStatus.IN_STOCK,
      });

      // Adapt matchInventoriesWithOrderItems or inline logic for ProtoOrderItem
      const invalidProtoOrderItems: QueryInput.InvalidOrderItemWithReason[] = [];
      const checkProductIdHandler = new CheckProductIdHandler();
      const checkQuantityHandler = new CheckQuantityHandler();
      checkProductIdHandler.setNext(checkQuantityHandler);

      for (const protoItem of req.orderItems) {
        // The handlers expect QueryInput.OrderItem, so we need to map or ensure compatibility
        // For simplicity, let's assume ProtoOrderItem has compatible fields (productId, quantity)
        // or create a temporary QueryInput.OrderItem
        const queryInputItem: QueryInput.OrderItem = {
            productId: protoItem.productId,
            quantity: protoItem.quantity,
            price: protoItem.price, // Assuming price is also in ProtoOrderItem
        };
        const reasons = checkProductIdHandler.handle(queryInputItem, matchingInventories);
        if (reasons.length > 0) {
          // The gRPC response expects InvalidOrderItemWithReason which contains ProtoOrderItem
          // Our QueryInput.InvalidOrderItemWithReason contains QueryInput.OrderItem.
          // We need to map this back if the structures are different, or adjust InvalidOrderItemWithReason in proto.
          // For now, let's assume QueryInput.InvalidOrderItemWithReason is compatible enough for the reasons array.
          // The actual item in the response should be the ProtoOrderItem.
          invalidProtoOrderItems.push({
            orderItem: queryInputItem, // This should ideally be the original protoItem if structures differ significantly
            reasons: reasons
          });
        }
      }

      if (invalidProtoOrderItems.length > 0) {
        // Map invalidProtoOrderItems to the structure expected by ValidateInventoryRes.invalidOrderItems
        // This involves ensuring each item in invalidOrderItems has a ProtoOrderItem.
        // If QueryInput.OrderItem and ProtoOrderItem are identical in structure, this is simpler.
        // For now, assuming QueryInput.InvalidOrderItemWithReason is directly usable or needs minor mapping.
        return {
          success: false,
          // This mapping might be more complex if QueryInput.OrderItem and ProtoOrderItem differ.
          // The proto expects InvalidOrderItemWithReason which has an 'OrderItem' (ProtoOrderItem) field.
          // Our current invalidProtoOrderItems has 'orderItem' (QueryInput.OrderItem).
          // Let's adjust the mapping:
          invalidOrderItems: invalidProtoOrderItems.map(ipi => ({
            orderItem: { // This needs to be ProtoOrderItem
                productId: ipi.orderItem.productId,
                price: ipi.orderItem.price,
                quantity: ipi.orderItem.quantity
            },
            reasons: ipi.reasons
          }))
        };
      } else {
        return {
          success: true,
          invalidOrderItems: [] // Explicitly return empty array for success
        };
      }
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`, error.stack, this.loggerContext);
      // Ensure the gRPC response structure is met even in case of an unhandled error
      return { success: false, invalidOrderItems: [{ orderItem: null, reasons: [error.message] }] };
    }
  }

  // This private method might need to be removed or adapted if its DTOs are no longer used.
  // For now, it's not directly called by the public validate method.
  /*
  private matchInventoriesWithOrderItems(
    itemsDto: ValidateOrderItemsReqDto, // This DTO is problematic now
    inventories: Inventory[],
  ): Array<QueryInput.InvalidOrderItemWithReason> {
    // ... implementation ...
  }
  */

  async fetch(productId: string): Promise<Inventory> { // productId is now string
    const inventory = await this.inventoryRepository.findByProductId(productId);
    if (!inventory) {
      throw new NotFoundException(`Inventory for product ID ${productId} not found.`);
    }
    return inventory;
  }

 


  async reserveInventory(req: ReserveInventoryReq): Promise<ReserveInventoryRes> {
    this.logger.info(`Attempting to reserve inventory, user ${req.userId}`, this.loggerContext);
    const reservationDetails: ReservationStatus[] = [];
    let overallSuccess = true;

    try {
      await this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const transactionalInventoryRepo = this.inventoryRepository.getRepository(entityManager);
        for (const item of req.itemsToReserve) {
          const currentStatus: ReservationStatus = { productId: item.productId, reserved: false, reason: '', currentStock: 0 };
          try {
            let inventory = await transactionalInventoryRepo.findByProductId(item.productId);
            if (!inventory) {
              currentStatus.reason = 'PRODUCT_NOT_FOUND';
              overallSuccess = false;
            } else if (inventory.quantity < item.quantity) {
              currentStatus.reason = 'INSUFFICIENT_STOCK';
              currentStatus.currentStock = inventory.quantity;
              overallSuccess = false;
            } else {
              inventory.quantity -= item.quantity;
              inventory.reservedQuantity += item.quantity;
              inventory.status = inventory.quantity > 0 ? QueryInput.InventoryStatus.IN_STOCK : QueryInput.InventoryStatus.OUT_OF_STOCK;
              await transactionalInventoryRepo.update(inventory.id, inventory); // Use repository's update method
              currentStatus.reserved = true;
              currentStatus.currentStock = inventory.quantity;
            }
          } catch (e) {
            this.logger.error(`Error reserving item ${item.productId}: ${e.message}`, e.stack, this.loggerContext);
            currentStatus.reason = e.message || 'RESERVATION_FAILED';
            overallSuccess = false;
          }
          reservationDetails.push(currentStatus);
        }
        if (!overallSuccess) {
          throw new Error('One or more items could not be reserved.'); // This will trigger rollback
        }
      });
    } catch (error) { // Catch error from transactionService or the explicit throw
      this.logger.error(`Inventory reservation failed : ${error.message}`, error.stack, this.loggerContext);
      overallSuccess = false; // Ensure this is set if an error bubbles up
      // For items that might have been processed before the error that caused rollback,
      // their status in reservationDetails might be true, but they are not persisted.
      // It's safer to mark all as failed or rely on the overallSuccess flag.
      // To be more precise, one might re-evaluate statuses here if needed, but gRPC error is primary.
      reservationDetails.forEach(detail => { if(overallSuccess === false) detail.reserved = false; });
    }
    return { overallSuccess, reservationDetails };
  }

  async releaseInventory(req: ReleaseInventoryReq): Promise<ReleaseInventoryRes> {
    this.logger.info(`Attempting to release inventory`, this.loggerContext);
    const releaseDetails: ReleaseStatus[] = [];
    let overallSuccess = true;

    try {
      await this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const transactionalInventoryRepo = this.inventoryRepository.getRepository(entityManager);
        for (const item of req.itemsToRelease) {
          const currentStatus: ReleaseStatus = { productId: item.productId, released: false, reason: '', currentStock: 0 };
          try {
            let inventory = await transactionalInventoryRepo.findByProductId(item.productId);
            if (!inventory) {
              currentStatus.reason = 'PRODUCT_NOT_FOUND';
              overallSuccess = false;
            } else if (inventory.reservedQuantity < item.quantity) {
              currentStatus.reason = 'RELEASE_EXCEEDS_RESERVATION';
              currentStatus.currentStock = inventory.quantity; // Current available stock
              overallSuccess = false;
            } else {
              if(req.type =="clear-cart"){
                 inventory.quantity += item.quantity; // Add back to available
                 inventory.status = QueryInput.InventoryStatus.IN_STOCK; // Should always be in stock if adding back
              }
              inventory.reservedQuantity -= item.quantity;
              await transactionalInventoryRepo.update(inventory.id, inventory); // Use repository's update method
              currentStatus.released = true;
              currentStatus.currentStock = inventory.quantity;
            }
          } catch (e) {
            this.logger.error(`Error releasing item ${item.productId}: ${e.message}`, e.stack, this.loggerContext);
            currentStatus.reason = e.message || 'RELEASE_FAILED';
            overallSuccess = false;
          }
          releaseDetails.push(currentStatus);
        }
        if (!overallSuccess) {
          throw new Error('One or more items could not be released.'); // Trigger rollback
        }
        return true; // Commit transaction if all successful
      });
    } catch (error) {
      this.logger.error(`Inventory release failed: ${error.message}`, error.stack, this.loggerContext);
      overallSuccess = false;
      releaseDetails.forEach(detail => { if(overallSuccess === false) detail.released = false; });
    }
    return { overallSuccess, releaseDetails };
  }

  async delete(productId: string): Promise<boolean> { // productId is now string
    // Ensure this makes sense. Deleting inventory might need checks (e.g., no stock, no reservations)
    // The current repository delete takes `id` (PK), not `productId`.
    // This needs to be aligned. Assuming we want to delete by `productId`.
    const inventory = await this.inventoryRepository.findByProductId(productId);
    if (!inventory) {
        throw new NotFoundException(`Inventory for product ID ${productId} not found, cannot delete.`);
    }
    return this.inventoryRepository.delete(inventory.id); // Use the PK for deletion
  }

  async processInventoryReplenishment(items: ReplenishItem): Promise<void> {
    this.logger.info(`Processing inventory replenishment for item type: ${items.productId}.`, this.loggerContext);
    if (!items || items.quantity <= 0) {
      this.logger.info('No valid items to replenish.', this.loggerContext);
      return;
    }

    await this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
      const transactionalInventoryRepo = this.inventoryRepository.getRepository(entityManager);
      const inventory = await transactionalInventoryRepo.findByProductId(items.productId.toString()); // Ensure productId is string

      if (!inventory) {
        this.logger.info(`Invalid item data for replenishment: ${JSON.stringify(items)}. Skipping.`, this.loggerContext); // Changed warn to info
        return;
      }

      const oldQuantity = inventory.quantity;
      inventory.quantity += items.quantity;
      // Update status if it was out of stock
      if (inventory.quantity > 0 && inventory.status === QueryInput.InventoryStatus.OUT_OF_STOCK) {
        inventory.status = QueryInput.InventoryStatus.IN_STOCK;
      }
      await transactionalInventoryRepo.update(inventory.id, {
        quantity: inventory.quantity,
        status: inventory.status,
      });
      this.logger.info(
        `Replenished inventory for productId ${items.productId}: ${oldQuantity} -> ${inventory.quantity}`,
        this.loggerContext,
      );
      return true; // Commit transaction if successful
    });
  this.logger.info('Inventory replenishment processing complete.', this.loggerContext);
}
}
