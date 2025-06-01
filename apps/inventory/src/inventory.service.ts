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
import { RemoveInventoryHandler } from './kafka-handlers/remove-inventory.handler'; // Renamed handler import
import { ReserveInventoryHandler } from './kafka-handlers/reserve-inventory.handler';
import { InventoryKafkaMetricsService } from './monitoring/inventory-kafka-metrics.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly loggerContext = InventoryService.name;

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly transactionService: TransactionService,
    private readonly logger: LoggerService,
    @Inject('KafkaConsumerInstance') private readonly kafkaConsumer: KafkaConsumer,
    private readonly removeInventoryHandler: RemoveInventoryHandler, // Use new handler
    private readonly reserveInventoryHandler: ReserveInventoryHandler,
    private readonly inventoryKafkaMetrics: InventoryKafkaMetricsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const removeInventoryTopic = this.configService.get('REMOVE_INVENTORY_TOPIC');
    const reserveInventoryTopic = this.configService.get('RESERVE_INVENTORY_TOPIC');
    if (!(this.kafkaConsumer as any)._subscribedTopics) {
      await this.kafkaConsumer.subscribe(reserveInventoryTopic);
      await this.kafkaConsumer.subscribe(removeInventoryTopic);
      (this.kafkaConsumer as any)._subscribedTopics = true;
    }
    await this.kafkaConsumer.postSubscribeCallback({
      handleMessage: async (topic, partition, message, headers) => {
        if (topic === reserveInventoryTopic) {
          await this.reserveInventoryHandler.handleMessage(topic, partition, message, headers);
        } else if (topic === removeInventoryTopic) {
          await this.removeInventoryHandler.handleMessage(topic, partition, message, headers);
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
              inventory.quantity += item.quantity; // Add back to available
              inventory.reservedQuantity -= item.quantity;
              inventory.status = QueryInput.InventoryStatus.IN_STOCK; // Should always be in stock if adding back
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
      });
    } catch (error) {
      this.logger.error(`Inventory release failed: ${error.message}`, error.stack, this.loggerContext);
      overallSuccess = false;
      releaseDetails.forEach(detail => { if(overallSuccess === false) detail.released = false; });
    }
    return { overallSuccess, releaseDetails };
  }

  async eventBasedUpdate(kafkaConsumer: KafkaConsumer) {
    // This method needs to be carefully designed based on the exact nature of events.
    // Assuming events are for confirmed sales that need to finalize stock deduction from reserved.
    // Or direct stock adjustments (e.g. new shipment, damage write-off).
    // For now, let's assume a simple event: { productId: string, quantitySoldAndShipped: number }
    // This means this quantity should be removed from reserved and effectively from total.
    // Pass the injected handler instance to postSubscribeCallback
    await kafkaConsumer.postSubscribeCallback(this.removeInventoryHandler);
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
}
