import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway, OrderStatusUpdate, InventoryUpdate } from './events.gateway';

export interface WebSocketStats {
  connectedClients: number;
  authenticatedUsers: number;
  onlineUsers: number[];
  rooms: any;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  /**
   * Broadcast order status update to connected clients
   */
  async broadcastOrderStatusUpdate(orderUpdate: OrderStatusUpdate): Promise<void> {
    try {
      this.eventsGateway.broadcastOrderUpdate(orderUpdate);
      this.logger.log(`Order update broadcasted for order ${orderUpdate.aliasId}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast order update: ${error.message}`);
    }
  }

  /**
   * Broadcast inventory update to connected clients
   */
  async broadcastInventoryUpdate(inventoryUpdate: InventoryUpdate): Promise<void> {
    try {
      this.eventsGateway.broadcastInventoryUpdate(inventoryUpdate);
      this.logger.log(`Inventory update broadcasted for product ${inventoryUpdate.productId}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast inventory update: ${error.message}`);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendUserNotification(userId: number, notification: any): Promise<void> {
    try {
      this.eventsGateway.sendUserNotification(userId, notification);
      this.logger.log(`User notification sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send user notification: ${error.message}`);
    }
  }

  /**
   * Broadcast system-wide notification
   */
  async broadcastSystemNotification(notification: any): Promise<void> {
    try {
      this.eventsGateway.broadcastSystemNotification(notification);
      this.logger.log('System notification broadcasted');
    } catch (error) {
      this.logger.error(`Failed to broadcast system notification: ${error.message}`);
    }
  }

  /**
   * Send notification to users with specific role
   */
  async sendRoleNotification(role: string, notification: any): Promise<void> {
    try {
      this.eventsGateway.sendRoleNotification(role, notification);
      this.logger.log(`Role notification sent to ${role}`);
    } catch (error) {
      this.logger.error(`Failed to send role notification: ${error.message}`);
    }
  }

  /**
   * Check if specific user is online
   */
  isUserOnline(userId: number): boolean {
    return this.eventsGateway.isUserOnline(userId);
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): number[] {
    return this.eventsGateway.getOnlineUsers();
  }

  /**
   * Get WebSocket connection statistics
   */
  getConnectionStats(): WebSocketStats {
    const stats = this.eventsGateway.getConnectionStats();
    return {
      connectedClients: stats.connectedClients,
      authenticatedUsers: stats.authenticatedUsers,
      onlineUsers: this.getOnlineUsers(),
      rooms: stats.rooms,
    };
  }

  /**
   * Send order creation notification to user
   */
  async notifyOrderCreated(orderData: {
    orderId: string;
    aliasId: string;
    userId: number;
    totalAmount: number;
    status: string;
  }): Promise<void> {
    const notification = {
      type: 'order_created',
      title: 'Order Created Successfully',
      message: `Your order ${orderData.aliasId} has been created successfully`,
      data: orderData,
    };

    await this.sendUserNotification(orderData.userId, notification);

    // Also broadcast as order status update
    const orderUpdate: OrderStatusUpdate = {
      orderId: orderData.orderId,
      aliasId: orderData.aliasId,
      status: orderData.status,
      userId: orderData.userId,
      timestamp: new Date(),
      message: 'Order created successfully',
    };

    await this.broadcastOrderStatusUpdate(orderUpdate);
  }

  /**
   * Send order status update notification
   */
  async notifyOrderStatusUpdate(orderData: {
    orderId: string;
    aliasId: string;
    userId: number;
    newStatus: string;
    previousStatus?: string;
    message?: string;
  }): Promise<void> {
    const notification = {
      type: 'order_status_update',
      title: 'Order Status Updated',
      message: orderData.message || `Your order ${orderData.aliasId} status has been updated to ${orderData.newStatus}`,
      data: orderData,
    };

    await this.sendUserNotification(orderData.userId, notification);

    // Also broadcast as order status update
    const orderUpdate: OrderStatusUpdate = {
      orderId: orderData.orderId,
      aliasId: orderData.aliasId,
      status: orderData.newStatus,
      userId: orderData.userId,
      timestamp: new Date(),
      message: orderData.message,
    };

    await this.broadcastOrderStatusUpdate(orderUpdate);
  }

  /**
   * Send low stock alert to admin users
   */
  async notifyLowStock(productData: {
    productId: number;
    productName: string;
    currentQuantity: number;
    threshold: number;
  }): Promise<void> {
    const inventoryUpdate: InventoryUpdate = {
      productId: productData.productId,
      quantity: productData.currentQuantity,
      status: 'low_stock',
      threshold: productData.threshold,
      timestamp: new Date(),
    };

    await this.broadcastInventoryUpdate(inventoryUpdate);

    const notification = {
      type: 'low_stock_alert',
      title: 'Low Stock Alert',
      message: `Product ${productData.productName} (ID: ${productData.productId}) is running low. Current stock: ${productData.currentQuantity}, Threshold: ${productData.threshold}`,
      data: productData,
    };

    await this.sendRoleNotification('admin', notification);
  }

  /**
   * Send out of stock alert to admin users
   */
  async notifyOutOfStock(productData: {
    productId: number;
    productName: string;
  }): Promise<void> {
    const inventoryUpdate: InventoryUpdate = {
      productId: productData.productId,
      quantity: 0,
      status: 'out_of_stock',
      timestamp: new Date(),
    };

    await this.broadcastInventoryUpdate(inventoryUpdate);

    const notification = {
      type: 'out_of_stock_alert',
      title: 'Out of Stock Alert',
      message: `Product ${productData.productName} (ID: ${productData.productId}) is now out of stock`,
      data: productData,
    };

    await this.sendRoleNotification('admin', notification);
  }

  /**
   * Send stock replenishment notification
   */
  async notifyStockReplenished(productData: {
    productId: number;
    productName: string;
    newQuantity: number;
  }): Promise<void> {
    const inventoryUpdate: InventoryUpdate = {
      productId: productData.productId,
      quantity: productData.newQuantity,
      status: 'restocked',
      timestamp: new Date(),
    };

    await this.broadcastInventoryUpdate(inventoryUpdate);

    const notification = {
      type: 'stock_replenished',
      title: 'Stock Replenished',
      message: `Product ${productData.productName} (ID: ${productData.productId}) has been restocked. New quantity: ${productData.newQuantity}`,
      data: productData,
    };

    await this.sendRoleNotification('admin', notification);
  }
}