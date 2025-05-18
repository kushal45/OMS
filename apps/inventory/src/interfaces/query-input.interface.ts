export namespace QueryInput {
  export enum InventoryStatus {
    IN_STOCK = 'in-stock',
    OUT_OF_STOCK = 'out-of-stock',
  }
  export interface FetchInStockProductsInput {
    productId: number[]| number;
    status: InventoryStatus;
  }

  export interface OrderItem {
    productId: number;
    price: number;
    quantity: number;
  }

  export interface InventoryItem {
    productId: number;
    quantity: number;
  }

  export interface InvalidOrderItemWithReason {
    orderItem: QueryInput.OrderItem;
    reasons: string[];
  }
}
