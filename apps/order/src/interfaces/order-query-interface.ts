import { OrderStatus } from "../entity/order.entity";

export namespace OrderQueryInterface {
  export interface fetchOrderInput{
    id: number;
    aliasId: string;
  }

  export interface UpdateOrderInput{
    aliasId?: string;
    addressId?: number;
    userId?: number;
    orderStatus?: OrderStatus; // Ensure this matches the enum type
    totalAmount?: number;
    deliveryCharge?: number;
    tax?: number;
  }
}