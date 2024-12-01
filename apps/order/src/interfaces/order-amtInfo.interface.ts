export interface OrderItemObj {
    productId: number;
    price: number;
    quantity: number;
  }
  
  export interface OrderAmtInfo {
    totalAmount: number;
    tax: number;
    deliveryCharge: number;
  }

  export interface OrderConfig {
    taxRate: number;
    deliveryCharge: number;
    deliveryChargeThreshold?: number;
  }