import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface OrderCreationNotification {
  orderId: string;
  aliasId: string;
  userId: number;
  totalAmount: number;
  status: string;
}

export interface OrderStatusUpdateNotification {
  orderId: string;
  aliasId: string;
  userId: number;
  newStatus: string;
  previousStatus?: string;
  message?: string;
}

export interface InventoryAlert {
  productId: number;
  productName: string;
  currentQuantity?: number;
  threshold?: number;
  alertType: 'low_stock' | 'out_of_stock' | 'restocked';
  newQuantity?: number;
}

@Injectable()
export class WebSocketClientService {
  private readonly logger = new Logger(WebSocketClientService.name);
  private readonly apiGatewayUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiGatewayUrl = this.configService.get<string>('API_GATEWAY_URL', 'http://gateway:3000');
  }

  /**
   * Notify WebSocket clients about order creation
   */
  async notifyOrderCreated(orderData: OrderCreationNotification): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiGatewayUrl}/websocket/notifications/order-created`,
          orderData,
        ),
      );

      if (response.data.success) {
        this.logger.log(`Order creation notification sent for order ${orderData.aliasId}`);
        return true;
      } else {
        this.logger.error(`Failed to send order creation notification: ${response.data.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending order creation notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Notify WebSocket clients about order status updates
   */
  async notifyOrderStatusUpdate(orderUpdate: OrderStatusUpdateNotification): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiGatewayUrl}/websocket/notifications/order-status-update`,
          orderUpdate,
        ),
      );

      if (response.data.success) {
        this.logger.log(`Order status update notification sent for order ${orderUpdate.aliasId}`);
        return true;
      } else {
        this.logger.error(`Failed to send order status update notification: ${response.data.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending order status update notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Send inventory alert to WebSocket clients
   */
  async sendInventoryAlert(alert: InventoryAlert): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiGatewayUrl}/websocket/notifications/inventory-alert`,
          alert,
        ),
      );

      if (response.data.success) {
        this.logger.log(`Inventory alert sent for product ${alert.productId}: ${alert.alertType}`);
        return true;
      } else {
        this.logger.error(`Failed to send inventory alert: ${response.data.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending inventory alert: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast custom notification
   */
  async broadcastNotification(notification: {
    type: 'system' | 'role' | 'user';
    title: string;
    message: string;
    data?: any;
    targetRole?: string;
    targetUserId?: number;
  }): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiGatewayUrl}/websocket/broadcast`,
          notification,
        ),
      );

      if (response.data.success) {
        this.logger.log(`Notification broadcasted: ${notification.type} - ${notification.title}`);
        return true;
      } else {
        this.logger.error(`Failed to broadcast notification: ${response.data.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error broadcasting notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: number): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiGatewayUrl}/websocket/users/${userId}/online`),
      );

      return response.data.online;
    } catch (error) {
      this.logger.error(`Error checking if user ${userId} is online: ${error.message}`);
      return false;
    }
  }

  /**
   * Get WebSocket connection statistics
   */
  async getConnectionStats(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiGatewayUrl}/websocket/stats`),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting connection stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper method for order service integration
   */
  async triggerOrderNotifications(orderData: {
    orderId: string;
    aliasId: string;
    userId: number;
    totalAmount: number;
    status: string;
    isNewOrder?: boolean;
    previousStatus?: string;
    message?: string;
  }): Promise<void> {
    if (orderData.isNewOrder) {
      await this.notifyOrderCreated({
        orderId: orderData.orderId,
        aliasId: orderData.aliasId,
        userId: orderData.userId,
        totalAmount: orderData.totalAmount,
        status: orderData.status,
      });
    } else {
      await this.notifyOrderStatusUpdate({
        orderId: orderData.orderId,
        aliasId: orderData.aliasId,
        userId: orderData.userId,
        newStatus: orderData.status,
        previousStatus: orderData.previousStatus,
        message: orderData.message,
      });
    }
  }

  /**
   * Helper method for inventory service integration
   */
  async triggerInventoryNotifications(inventoryData: {
    productId: number;
    productName: string;
    currentQuantity: number;
    previousQuantity?: number;
    threshold?: number;
  }): Promise<void> {
    const { productId, productName, currentQuantity, previousQuantity, threshold } = inventoryData;

    // Determine alert type based on quantity changes
    let alertType: 'low_stock' | 'out_of_stock' | 'restocked' | null = null;

    if (currentQuantity === 0 && (previousQuantity === undefined || previousQuantity > 0)) {
      alertType = 'out_of_stock';
    } else if (currentQuantity > 0 && previousQuantity === 0) {
      alertType = 'restocked';
    } else if (threshold && currentQuantity <= threshold && currentQuantity > 0) {
      alertType = 'low_stock';
    }

    if (alertType) {
      const alert: InventoryAlert = {
        productId,
        productName,
        alertType,
        currentQuantity: alertType === 'out_of_stock' ? undefined : currentQuantity,
        threshold: alertType === 'low_stock' ? threshold : undefined,
        newQuantity: alertType === 'restocked' ? currentQuantity : undefined,
      };

      await this.sendInventoryAlert(alert);
    }
  }
}