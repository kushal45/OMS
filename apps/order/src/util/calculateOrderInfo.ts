import { OrderItemObj, OrderAmtInfo,OrderConfig } from '../interfaces/order-amtInfo.interface';
import { DeliveryChargeStrategy } from '../interfaces/delivery-charge.interface';

export function getOrderInfo(
  orderItems: OrderItemObj[],
  config: OrderConfig,
  deliveryChargeStrategy: DeliveryChargeStrategy
): OrderAmtInfo {
  const orderInfo: OrderAmtInfo = {
    totalAmount: 0,
    tax: 0,
    deliveryCharge: 0,
  };

  for (const orderItem of orderItems) {
    orderInfo.totalAmount += orderItem.price * orderItem.quantity;
    orderInfo.tax += orderItem.price * orderItem.quantity * (config.taxRate / 100);
  }

  orderInfo.deliveryCharge = deliveryChargeStrategy.calculateDeliveryCharge(orderInfo.totalAmount, config);

  return orderInfo;
}