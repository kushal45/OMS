import { OrderConfig } from "./order-amtInfo.interface";

export interface DeliveryChargeStrategy {
    calculateDeliveryCharge(totalAmount: number, config: OrderConfig): number;
  }