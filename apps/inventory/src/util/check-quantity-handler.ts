import { QueryInput} from '../interfaces/query-input.interface';

export class CheckQuantityHandler {
  private nextHandler: CheckQuantityHandler;

  setNext(handler: CheckQuantityHandler): CheckQuantityHandler {
    this.nextHandler = handler;
    return handler;
  }

  handle(orderItem: QueryInput.OrderItem, inventory: QueryInput.InventoryItem[]): string[] {
    const reasons: string[] = [];
    const matchingInventory = inventory.find(item => item.productId === orderItem.productId);

    if (matchingInventory && orderItem.quantity > matchingInventory.quantity) {
      reasons.push(`Quantity for product ID ${orderItem.productId} is more than available in inventory (${matchingInventory.quantity}).`);
    }

    return reasons;
  }
}