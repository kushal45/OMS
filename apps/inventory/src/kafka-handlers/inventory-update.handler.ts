import { Injectable } from '@nestjs/common';
import { IMessageHandler } from '@lib/kafka/interfaces/message-handler.interface';
import { LoggerService } from '@lib/logger/src';
import { TransactionService } from '@app/utils/transaction.service';
import { InventoryRepository } from '../repository/inventory.repository';
import { IHeaders } from 'kafkajs';
import { EntityManager } from 'typeorm';

@Injectable()
export class InventoryUpdateHandler implements IMessageHandler {
  private readonly loggerContext = 'InventoryUpdateHandler';

  constructor(
    private readonly logger: LoggerService,
    private readonly transactionService: TransactionService,
    private readonly inventoryRepository: InventoryRepository,
  ) {
    // It's good practice to set the context for the logger if it's specific to this handler
    // However, LoggerService methods usually accept a context parameter.
    // this.logger.setContext(this.loggerContext); // This line might not be needed depending on LoggerService implementation
  }

  async handleMessage(topic: string, partition: number, message: any, headers?: IHeaders): Promise<void> {
    this.logger.info(
      `Received Kafka message from topic ${topic}, partition ${partition}`, this.loggerContext
    );

    try {
      // Assuming 'message' is already the decoded payload from KafkaConsumer
      const payload = typeof message === 'string' ? JSON.parse(message) : message;

      // Validate payload structure (this should be more robust, perhaps using DTOs and class-validator)
      const productId = payload?.productId as string;
      const quantityFinalizedStr = payload?.quantity as string; // or quantitySoldAndShipped based on original code

      if (!productId || quantityFinalizedStr ==null) {
        this.logger.error(
          `Invalid payload structure for inventory update from Kafka. ProductId or quantitySold is missing. Payload: ${JSON.stringify(payload)}`,
          this.loggerContext
        );
        return; // Stop processing this message
      }

      const quantityFinalized = parseInt(quantityFinalizedStr, 10);

      if (isNaN(quantityFinalized)) {
        this.logger.error(
          `Invalid quantitySold value: '${quantityFinalizedStr}'. Expected a number. Payload: ${JSON.stringify(payload)}`,
          this.loggerContext
        );
        return; // Stop processing this message
      }

      this.logger.info(`Processing inventory finalization for product ${productId}, quantity: ${quantityFinalized}`, this.loggerContext);

      // The transaction block now expects a boolean return for controlled rollback, or throws for other errors.
      const transactionResult = await this.transactionService.executeInTransaction(async (entityManager: EntityManager): Promise<boolean> => {
        const transactionalInventoryRepo = this.inventoryRepository.getRepository(entityManager);
        const inventory = await transactionalInventoryRepo.findByProductId(productId);

        if (!inventory) {
          this.logger.error(`Inventory not found for product ${productId} during Kafka event processing. Transaction will be rolled back.`, this.loggerContext);
          return false; // Signal controlled rollback
        }

        // Check if there's enough reserved quantity
        if (inventory.reservedQuantity < quantityFinalized) {
          this.logger.error(
            `Cannot finalize sale for product ${productId}: requested ${quantityFinalized}, reserved ${inventory.reservedQuantity}. Potential inconsistency. Transaction will be rolled back.`,
            this.loggerContext
          );
          //return false; // Signal controlled rollback
        }else{
          // Deduct from reserved quantity
          inventory.reservedQuantity -= quantityFinalized;
          this.logger.info(`Reserved quantity for product ${productId} updated to ${inventory.reservedQuantity}`, this.loggerContext);
        }

        // Deduct from reserved quantity
       

        // Also deduct from the main quantity as this is finalization of sale
        // The original logic at line 82: inventory.quantity -= quantityFinalized;
        // This assumes 'quantity' is the total physical stock.
        if (inventory.quantity < quantityFinalized) {
            this.logger.error(
                `Physical stock for product ${productId} (${inventory.quantity}) is less than finalized quantity (${quantityFinalized}) after considering reservation. This indicates a severe inconsistency. Transaction will be rolled back.`,
                this.loggerContext
            );
            return false; // Critical inconsistency
        }
        inventory.quantity -= quantityFinalized;


        // Update status based on new quantity
        // inventory.status = inventory.quantity > 0 ? QueryInput.InventoryStatus.IN_STOCK : QueryInput.InventoryStatus.OUT_OF_STOCK;
        // The above line for status is commented out as it's not in the original diff's target logic, but good to consider.

        await transactionalInventoryRepo.update(inventory.id, {
          reservedQuantity: inventory.reservedQuantity,
          quantity: inventory.quantity,
          // status: inventory.status, // if status is also updated
        });

        this.logger.info(`Inventory finalized for product ${productId}, new reserved: ${inventory.reservedQuantity}, new quantity: ${inventory.quantity}. Transaction will be committed.`, this.loggerContext);
        return true; // Signal success for commit
      });

      // transactionResult will be true if committed, or an error would have been thrown by TransactionService
      // if it was rolled back due to returning false or an exception.
      // So, no specific check for `transactionResult === false` is needed here as TransactionService handles it.

    } catch (error) {
      this.logger.error(
        `Failed to process inventory update from Kafka: ${error.message}. Original message: ${JSON.stringify(message)}`,
        error.stack,
        this.loggerContext
      );
      // Re-throw the error if you want the KafkaConsumer's error handling to take over
      // (e.g., to potentially stop the consumer or trigger a DLQ mechanism if configured).
      // Otherwise, the error is logged here, and the consumer continues with the next message.
      throw error; // Propagate error to be caught by KafkaConsumer's generic handler
    }
  }
}