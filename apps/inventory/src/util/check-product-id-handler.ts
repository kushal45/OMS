import { QueryInput } from '../interfaces/query-input.interface';
import { CheckQuantityHandler } from './check-quantity-handler';

export class CheckProductIdHandler {
  private nextHandler: CheckQuantityHandler;

  setNext(handler: CheckQuantityHandler): CheckQuantityHandler {
    this.nextHandler = handler;
    return handler;
  }

  handle(orderItem: QueryInput.OrderItem, inventory:QueryInput.InventoryItem[]): string[] {
    const reasons: string[] = [];
    const matchingInventory = inventory.find(item => item.productId == orderItem.productId);

    if (!matchingInventory) {
      reasons.push(`Product ID ${orderItem.productId} is missing in inventory.`);
      return reasons;
    }

    if (this.nextHandler) {
      reasons.push(...this.nextHandler.handle(orderItem, inventory));
    }

    return reasons;
  }
}