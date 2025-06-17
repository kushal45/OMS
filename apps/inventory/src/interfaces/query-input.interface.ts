export namespace QueryInput {
  export enum InventoryStatus {
    IN_STOCK = 'in-stock',
    OUT_OF_STOCK = 'out-of-stock',
  }
  export interface FetchInStockProductsInput {
    productId: string[]| string; // Changed from number
    status: InventoryStatus;
  }

  export interface OrderItem {
    productId: string; // Changed from number
    price: number;
    quantity: number;
  }

  export interface InventoryItem {
    productId: string; // Changed from number
    quantity: number;
  }

  export interface InvalidOrderItemWithReason {
    orderItem: QueryInput.OrderItem;
    reasons: string[];
  }
}
