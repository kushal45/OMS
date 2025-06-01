import { Injectable } from '@nestjs/common';
import { IMessageHandler } from '@lib/kafka/interfaces/message-handler.interface';
import { LoggerService } from '@lib/logger/src';
import { TransactionService } from '@app/utils/transaction.service';
import { InventoryRepository } from '../repository/inventory.repository';
import { IHeaders } from 'kafkajs';
import { EntityManager } from 'typeorm';

@Injectable()
export class RemoveInventoryHandler implements IMessageHandler {
  private readonly loggerContext = 'RemoveInventoryHandler';

  constructor(
    private readonly logger: LoggerService,
    private readonly transactionService: TransactionService,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async handleMessage(topic: string, partition: number, message: any, headers?: IHeaders): Promise<void> {
    this.logger.info(
      `Received Kafka message from topic ${topic}, partition ${partition}`, this.loggerContext
    );

    try {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      const productId = payload?.productId as string;
      const quantityToRemoveStr = payload?.quantity as string;

      if (!productId || quantityToRemoveStr == null) {
        this.logger.error(
          `Invalid payload structure for remove inventory from Kafka. ProductId or quantity is missing. Payload: ${JSON.stringify(payload)}`,
          this.loggerContext
        );
        return;
      }

      const quantityToRemove = parseInt(quantityToRemoveStr, 10);
      if (isNaN(quantityToRemove)) {
        this.logger.error(
          `Invalid quantity value: '${quantityToRemoveStr}'. Expected a number. Payload: ${JSON.stringify(payload)}`,
          this.loggerContext
        );
        return;
      }

      await this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const repo = this.inventoryRepository.getRepository(entityManager);
        const inventory = await repo.findByProductId(productId);
        if (!inventory) {
          this.logger.error(`No inventory found for productId ${productId}`, this.loggerContext);
          return;
        }
        if (inventory.quantity < quantityToRemove) {
          this.logger.error(`Not enough inventory to remove for productId ${productId}. Requested: ${quantityToRemove}, Available: ${inventory.quantity}`, this.loggerContext);
          return;
        }
        inventory.quantity -= quantityToRemove;
        await repo.update(inventory.id, inventory);
        this.logger.info(`Removed ${quantityToRemove} from inventory for productId ${productId}. New quantity: ${inventory.quantity}`, this.loggerContext);
      });
    } catch (err) {
      this.logger.error(`Error processing remove inventory Kafka event: ${err.message}`, err.stack, this.loggerContext);
    }
  }
}
