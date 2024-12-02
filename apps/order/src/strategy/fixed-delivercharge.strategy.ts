import { DeliveryChargeStrategy } from '../interfaces/delivery-charge.interface';
import { OrderConfig } from '../interfaces/order-amtInfo.interface';

export class FixedDeliveryChargeStrategy implements DeliveryChargeStrategy {
  calculateDeliveryCharge(totalAmount: number, config: OrderConfig): number {
    if (config.deliveryChargeThreshold != 0 && totalAmount > config.deliveryChargeThreshold) {
      return 0;
    } else {
      return config.deliveryCharge;
    }
  }
}