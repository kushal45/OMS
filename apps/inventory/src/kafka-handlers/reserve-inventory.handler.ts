import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { IMessageHandler } from '@lib/kafka/interfaces/message-handler.interface';
import { LoggerService } from '@lib/logger/src';
import { InventoryService } from '../inventory.service';
import { InventoryKafkaMetricsService } from '../monitoring/inventory-kafka-metrics.service';

@Injectable()
export class ReserveInventoryHandler implements IMessageHandler {
  private readonly loggerContext = 'ReserveInventoryHandler';

  constructor(
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly inventoryKafkaMetrics: InventoryKafkaMetricsService,
  ) {}

  async handleMessage(topic: string, partition: number, message: any, headers?: any): Promise<void> {
    const events = Array.isArray(message) ? message : [message];
    for (const event of events) {
      const productId = event.productId;
      const quantity = Number(event.quantity);
      const endTimer = this.inventoryKafkaMetrics.kafkaReserveEventsDuration.startTimer();
      if (!productId || isNaN(quantity)) {
        this.logger.error(`Invalid reserveInventory event: ${JSON.stringify(event)}`, this.loggerContext);
        this.inventoryKafkaMetrics.kafkaReserveEventsFailed.inc({ reason: 'invalid_event' });
        this.inventoryKafkaMetrics.kafkaReserveEventsTotal.inc({ result: 'failed' });
        endTimer({ result: 'failed' });
        continue;
      }
      try {
        const reserveReq = {
          userId: event.userId || 'kafka',
          itemsToReserve: [{ productId, quantity, price: event.price ?? 0 }],
        };
        const result = await this.inventoryService.reserveInventory(reserveReq);
        if (!result.overallSuccess) {
          this.logger.error(`Failed to reserve inventory for product ${productId} from Kafka event: ${JSON.stringify(result.reservationDetails)}`, this.loggerContext);
          this.inventoryKafkaMetrics.kafkaReserveEventsFailed.inc({ reason: 'reserveInventory_failed' });
          this.inventoryKafkaMetrics.kafkaReserveEventsTotal.inc({ result: 'failed' });
          endTimer({ result: 'failed' });
        } else {
          this.inventoryKafkaMetrics.kafkaReserveEventsTotal.inc({ result: 'success' });
          endTimer({ result: 'success' });
        }
      } catch (err) {
        this.logger.error(`Error reserving inventory for product ${productId} from Kafka event: ${err.message}`, err.stack, this.loggerContext);
        this.inventoryKafkaMetrics.kafkaReserveEventsFailed.inc({ reason: 'exception' });
        this.inventoryKafkaMetrics.kafkaReserveEventsTotal.inc({ result: 'failed' });
        endTimer({ result: 'failed' });
      }
    }
  }
}
