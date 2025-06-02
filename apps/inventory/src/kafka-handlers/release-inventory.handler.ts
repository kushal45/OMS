import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InventoryService } from '../inventory.service';
import { LoggerService } from '@lib/logger/src';

@Injectable()
export class ReleaseInventoryHandler {
  private readonly context = ReleaseInventoryHandler.name;

  constructor(
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly logger: LoggerService,
  ) {}

  async handleMessage(topic: string, partition: number, message: any, headers?: any): Promise<void> {
    try {
      this.logger.info(
        `Consuming releaseInventory event from Kafka: ${JSON.stringify(message)}`,
        this.context,
      );
      // Build the ReleaseInventoryReq expected by releaseInventory
      const req = {
        userId: message.userId,
        type: message.type || 'place-order',
        itemsToRelease: [
          {
            productId: message.productId,
            quantity: message.quantity,
            price: message.price ?? 0,
          },
        ],
        traceId: message.traceId,
      };
      const result = await this.inventoryService.releaseInventory(req);
      this.logger.info(`releaseInventory result: ${JSON.stringify(result)}`, this.context);
    } catch (err) {
      this.logger.error(
        `Error processing releaseInventory event: ${err.message}`,
        err.stack,
        this.context,
      );
    }
  }
}
