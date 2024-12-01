import { DeliveryChargeStrategy } from "../interfaces/delivery-charge.interface";
import { OrderConfig } from "../interfaces/order-amtInfo.interface";

export class PercentageDeliveryChargeStrategy implements DeliveryChargeStrategy {
    calculateDeliveryCharge(totalAmount: number, config: OrderConfig): number {
      if (totalAmount > config.deliveryChargeThreshold) {
        return 0;
      } else {
        return totalAmount * (config.deliveryCharge / 100);
      }
    }
  }