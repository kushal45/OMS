import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  authenticated?: boolean;
}

export interface OrderStatusUpdate {
  orderId: string;
  aliasId: string;
  status: string;
  userId: number;
  timestamp: Date;
  message?: string;
}

export interface InventoryUpdate {
  productId: number;
  quantity: number;
  status: 'low_stock' | 'out_of_stock' | 'restocked';
  threshold?: number;
  timestamp: Date;
}

export interface RealTimeEvent {
  type: 'order_status' | 'inventory_update' | 'system_notification' | 'user_specific';
  data: any;
  userId?: number; // For user-specific events
  timestamp: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private userSockets = new Map<number, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);
      
      // Extract token from query params or headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without authentication token`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const decoded = await this.jwtService.verifyAsync(token,{
        secret: jwtSecret,
      });
      
      client.userId = decoded.sub || decoded.userId;
      client.userRole = decoded.role;
      client.authenticated = true;

      this.connectedClients.set(client.id, client);
      
      // Track user sockets for targeted messaging
      if (client.userId) {
        if (!this.userSockets.has(client.userId)) {
          this.userSockets.set(client.userId, new Set());
        }
        this.userSockets.get(client.userId)!.add(client.id);
      }

      // Join user to their personal room
      if (client.userId) {
        await client.join(`user_${client.userId}`);
      }

      // Join role-based rooms
      if (client.userRole) {
        await client.join(`role_${client.userRole}`);
      }

      this.logger.log(`Client ${client.id} authenticated as user ${client.userId} with role ${client.userRole}`);
      
      client.emit('connected', {
        message: 'Successfully connected to real-time events',
        userId: client.userId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove from connected clients
    this.connectedClients.delete(client.id);
    
    // Remove from user sockets tracking
    if (client.userId && this.userSockets.has(client.userId)) {
      this.userSockets.get(client.userId)!.delete(client.id);
      
      // Clean up empty sets
      if (this.userSockets.get(client.userId)!.size === 0) {
        this.userSockets.delete(client.userId);
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): any {
    return {
      event: 'pong',
      data: {
        timestamp: new Date(),
        clientId: client.id,
        userId: client.userId,
      },
    };
  }

  @SubscribeMessage('subscribe_to_orders')
  async handleSubscribeToOrders(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    await client.join('order_updates');
    this.logger.log(`Client ${client.id} subscribed to order updates`);
    
    client.emit('subscription_confirmed', {
      type: 'order_updates',
      message: 'Successfully subscribed to order updates',
    });
  }

  @SubscribeMessage('subscribe_to_inventory')
  async handleSubscribeToInventory(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    await client.join('inventory_updates');
    this.logger.log(`Client ${client.id} subscribed to inventory updates`);
    
    client.emit('subscription_confirmed', {
      type: 'inventory_updates',
      message: 'Successfully subscribed to inventory updates',
    });
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @MessageBody() data: { type: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const roomName = `${data.type}_updates`;
    await client.leave(roomName);
    
    this.logger.log(`Client ${client.id} unsubscribed from ${roomName}`);
    
    client.emit('subscription_cancelled', {
      type: data.type,
      message: `Unsubscribed from ${data.type} updates`,
    });
  }

  // ==== BROADCAST METHODS FOR SERVICES TO USE ====

  /**
   * Broadcast order status updates to relevant clients
   */
  broadcastOrderUpdate(orderUpdate: OrderStatusUpdate) {
    const event: RealTimeEvent = {
      type: 'order_status',
      data: orderUpdate,
      userId: orderUpdate.userId,
      timestamp: orderUpdate.timestamp,
    };

    // Send to specific user
    this.server.to(`user_${orderUpdate.userId}`).emit('order_update', event);
    
    // Send to admin/staff monitoring order updates
    this.server.to('role_admin').emit('order_update', event);
    this.server.to('role_staff').emit('order_update', event);
    
    // Send to order updates subscription room
    this.server.to('order_updates').emit('order_update', event);

    this.logger.log(`Broadcasted order update for order ${orderUpdate.aliasId} to user ${orderUpdate.userId}`);
  }

  /**
   * Broadcast inventory updates to relevant clients
   */
  broadcastInventoryUpdate(inventoryUpdate: InventoryUpdate) {
    const event: RealTimeEvent = {
      type: 'inventory_update',
      data: inventoryUpdate,
      timestamp: inventoryUpdate.timestamp,
    };

    // Send to inventory subscribers
    this.server.to('inventory_updates').emit('inventory_update', event);
    
    // Send to admins for low stock alerts
    if (inventoryUpdate.status === 'low_stock' || inventoryUpdate.status === 'out_of_stock') {
      this.server.to('role_admin').emit('inventory_alert', event);
    }

    this.logger.log(`Broadcasted inventory update for product ${inventoryUpdate.productId}: ${inventoryUpdate.status}`);
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(userId: number, notification: any) {
    const event: RealTimeEvent = {
      type: 'user_specific',
      data: notification,
      userId,
      timestamp: new Date(),
    };

    this.server.to(`user_${userId}`).emit('user_notification', event);
    this.logger.log(`Sent notification to user ${userId}`);
  }

  /**
   * Broadcast system-wide notifications
   */
  broadcastSystemNotification(notification: any) {
    const event: RealTimeEvent = {
      type: 'system_notification',
      data: notification,
      timestamp: new Date(),
    };

    this.server.emit('system_notification', event);
    this.logger.log('Broadcasted system notification');
  }

  /**
   * Send notifications to users with specific role
   */
  sendRoleNotification(role: string, notification: any) {
    const event: RealTimeEvent = {
      type: 'user_specific',
      data: notification,
      timestamp: new Date(),
    };

    this.server.to(`role_${role}`).emit('role_notification', event);
    this.logger.log(`Sent notification to role ${role}`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      authenticatedUsers: this.userSockets.size,
      rooms: this.server.sockets.adapter.rooms,
    };
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: number): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * Get online users
   */
  getOnlineUsers(): number[] {
    return Array.from(this.userSockets.keys());
  }
}