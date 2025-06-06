import { OrderStatus } from "../entity/order.entity";

export interface OrderInput {
    userId: number;
    addressId: number;
    totalAmount: number;
    deliveryCharge: number;
    tax: number;
    orderStatus?: OrderStatus;
  }