import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { IMessageHandler } from '@lib/kafka/interfaces/message-handler.interface';
import { LoggerService } from '@lib/logger/src';
import { InventoryService } from '../inventory.service'; // Adjusted path
import { IHeaders } from 'kafkajs';

// Define the expected structure of an item in the payload array
interface ReplenishPayloadItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class ReplenishInventoryHandler implements IMessageHandler {
  private readonly loggerContext = 'ReplenishInventoryHandler';

  constructor(
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService, // Inject InventoryService
  ) {}

  async handleMessage(topic: string, partition: number, message: any, headers?: IHeaders): Promise<void> {
    this.logger.info(
      `Received Kafka message from topic ${topic}, partition ${partition}`, this.loggerContext
    );

    try {
      const payload =( typeof message === 'string' ? JSON.parse(message) : message) as ReplenishPayloadItem;

  
      await this.inventoryService.processInventoryReplenishment(payload);

      this.logger.info(
        `Successfully processed replenish inventory event for ${JSON.stringify(payload)} item types.`,
        this.loggerContext
      );

    } catch (err) {
      this.logger.error(
        `Error processing replenish inventory Kafka event: ${err.message}`,
        err.stack,
        this.loggerContext
      );
      // Decide if re-throwing is appropriate or if the error should be handled here
      // For example, if the service method already handles logging and doesn't throw for non-critical errors
      // If the service method throws for critical errors, re-throwing might be desired.
      throw err; // Re-throw to allow KafkaJS to handle retry/DLQ if configured
    }
  }
}