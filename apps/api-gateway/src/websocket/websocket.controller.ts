import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { WebSocketService, WebSocketStats } from './websocket.service';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';
import { IsString, IsIn, IsOptional, IsNumber, IsObject } from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  @IsIn(['system', 'role', 'user'])
  type: 'system' | 'role' | 'user';

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  data?: any;

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsNumber()
  @IsOptional()
  targetUserId?: number;
}

export class OrderStatusUpdateDto {
  @IsString()
  orderId: string;

  @IsString()
  aliasId: string;

  @IsNumber()
  userId: number;

  @IsString()
  newStatus: string;

  @IsString()
  @IsOptional()
  previousStatus?: string;

  @IsString()
  @IsOptional()
  message?: string;
}

export class InventoryAlertDto {
  @IsNumber()
  productId: number;

  @IsString()
  productName: string;

  @IsNumber()
  @IsOptional()
  currentQuantity?: number;

  @IsNumber()
  @IsOptional()
  threshold?: number;

  @IsString()
  @IsIn(['low_stock', 'out_of_stock', 'restocked'])
  alertType: 'low_stock' | 'out_of_stock' | 'restocked';

  @IsNumber()
  @IsOptional()
  newQuantity?: number;
}

@Controller('websocket')
export class WebSocketController {
  constructor(private readonly webSocketService: WebSocketService) {}

  /**
   * Get WebSocket connection statistics
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getConnectionStats(): Promise<WebSocketStats> {
    return this.webSocketService.getConnectionStats();
  }

  /**
   * Check if specific user is online
   */
  @Get('users/:userId/online')
  @UseGuards(JwtAuthGuard)
  async isUserOnline(@Param('userId') userId: number): Promise<{ userId: number; online: boolean }> {
    const online = this.webSocketService.isUserOnline(userId);
    return { userId, online };
  }

  /**
   * Get list of online users
   */
  @Get('users/online')
  @UseGuards(JwtAuthGuard)
  async getOnlineUsers(): Promise<{ onlineUsers: number[] }> {
    const onlineUsers = this.webSocketService.getOnlineUsers();
    return { onlineUsers };
  }

  /**
   * Broadcast notification to connected clients
   */
  @Post('broadcast')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async broadcastNotification(@Body() notificationDto: BroadcastNotificationDto): Promise<{ success: boolean; message: string }> {
    try {
      const notification = {
        title: notificationDto.title,
        message: notificationDto.message,
        data: notificationDto.data || {},
        timestamp: new Date(),
      };

      switch (notificationDto.type) {
        case 'system':
          await this.webSocketService.broadcastSystemNotification(notification);
          break;
        case 'role':
          if (!notificationDto.targetRole) {
            return { success: false, message: 'Target role is required for role notifications' };
          }
          await this.webSocketService.sendRoleNotification(notificationDto.targetRole, notification);
          break;
        case 'user':
          if (!notificationDto.targetUserId) {
            return { success: false, message: 'Target user ID is required for user notifications' };
          }
          await this.webSocketService.sendUserNotification(notificationDto.targetUserId, notification);
          break;
        default:
          return { success: false, message: 'Invalid notification type' };
      }

      return { success: true, message: 'Notification broadcasted successfully' };
    } catch (error) {
      return { success: false, message: `Failed to broadcast notification: ${error.message}` };
    }
  }

  /**
   * Notify order creation
   */
  @Post('notifications/order-created')
  @HttpCode(HttpStatus.OK)
  async notifyOrderCreated(@Body() orderData: {
    orderId: string;
    aliasId: string;
    userId: number;
    totalAmount: number;
    status: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await this.webSocketService.notifyOrderCreated(orderData);
      return { success: true, message: 'Order creation notification sent' };
    } catch (error) {
      return { success: false, message: `Failed to send order creation notification: ${error.message}` };
    }
  }

  /**
   * Notify order status update
   */
  @Post('notifications/order-status-update')
  @HttpCode(HttpStatus.OK)
  async notifyOrderStatusUpdate(@Body() orderUpdateDto: OrderStatusUpdateDto): Promise<{ success: boolean; message: string }> {
    try {
      await this.webSocketService.notifyOrderStatusUpdate(orderUpdateDto);
      return { success: true, message: 'Order status update notification sent' };
    } catch (error) {
      return { success: false, message: `Failed to send order status update notification: ${error.message}` };
    }
  }

  /**
   * Send inventory alert
   */
  @Post('notifications/inventory-alert')
  @HttpCode(HttpStatus.OK)
  async sendInventoryAlert(@Body() inventoryAlertDto: InventoryAlertDto): Promise<{ success: boolean; message: string }> {
    try {
      const productData = {
        productId: inventoryAlertDto.productId,
        productName: inventoryAlertDto.productName,
        currentQuantity: inventoryAlertDto.currentQuantity,
        threshold: inventoryAlertDto.threshold,
        newQuantity: inventoryAlertDto.newQuantity,
      };

      switch (inventoryAlertDto.alertType) {
        case 'low_stock':
          if (productData.currentQuantity === undefined || productData.threshold === undefined) {
            return { success: false, message: 'Current quantity and threshold are required for low stock alerts' };
          }
          await this.webSocketService.notifyLowStock({
            productId: productData.productId,
            productName: productData.productName,
            currentQuantity: productData.currentQuantity,
            threshold: productData.threshold,
          });
          break;
        case 'out_of_stock':
          await this.webSocketService.notifyOutOfStock({
            productId: productData.productId,
            productName: productData.productName,
          });
          break;
        case 'restocked':
          if (productData.newQuantity === undefined) {
            return { success: false, message: 'New quantity is required for restock alerts' };
          }
          await this.webSocketService.notifyStockReplenished({
            productId: productData.productId,
            productName: productData.productName,
            newQuantity: productData.newQuantity,
          });
          break;
        default:
          return { success: false, message: 'Invalid alert type' };
      }

      return { success: true, message: 'Inventory alert sent' };
    } catch (error) {
      return { success: false, message: `Failed to send inventory alert: ${error.message}` };
    }
  }

  /**
   * Health check endpoint for WebSocket functionality
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: Date; stats: WebSocketStats }> {
    const stats = this.webSocketService.getConnectionStats();
    return {
      status: 'OK',
      timestamp: new Date(),
      stats,
    };
  }
}