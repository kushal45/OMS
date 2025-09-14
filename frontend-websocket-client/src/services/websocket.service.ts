import { io, Socket } from 'socket.io-client';

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
  timestamp: string;
  message?: string;
}

export interface InventoryUpdate {
  productId: number;
  quantity: number;
  status: 'low_stock' | 'out_of_stock' | 'restocked';
  threshold?: number;
  timestamp: string;
}

export interface RealTimeEvent {
  type: 'order_status' | 'inventory_update' | 'system_notification' | 'user_specific';
  data: any;
  userId?: number;
  timestamp: string;
}

export interface UserNotification {
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface ConnectionStats {
  connectedClients: number;
  authenticatedUsers: number;
  onlineUsers: number[];
  rooms: any;
}

export type WebSocketEventCallback = (data: any) => void;

export class WebSocketService {
  private socket: AuthenticatedSocket | null = null;
  private connectionUrl: string;
  private token: string | null = null;
  private eventCallbacks: Map<string, WebSocketEventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string = 'ws://localhost:3000') {
    this.connectionUrl = url;
  }

  /**
   * Connect to WebSocket server with JWT token
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        console.log('WebSocket already connected');
        resolve();
        return;
      }

      this.token = token;

      this.socket = io(`${this.connectionUrl}/events`, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000,
      }) as AuthenticatedSocket;

      // Connection successful
      this.socket.on('connected', (data) => {
        console.log('Connected to OMS WebSocket:', data);
        this.socket!.authenticated = true;
        this.socket!.userId = data.userId;
        this.reconnectAttempts = 0;
        this.triggerCallback('connected', data);
        resolve();
      });

      // Connection error
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.triggerCallback('connect_error', error);
        reject(error);
      });

      // Authentication error
      this.socket.on('error', (error) => {
        console.error('WebSocket authentication error:', error);
        this.triggerCallback('auth_error', error);
        reject(error);
      });

      // Disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.socket!.authenticated = false;
        this.triggerCallback('disconnected', { reason });
        
        // Auto-reconnect logic
        if (reason !== 'io client disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnect();
          }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
        }
      });

      // Pong response
      this.socket.on('pong', (data) => {
        this.triggerCallback('pong', data);
      });

      // Subscription confirmations
      this.socket.on('subscription_confirmed', (data) => {
        console.log('Subscription confirmed:', data);
        this.triggerCallback('subscription_confirmed', data);
      });

      this.socket.on('subscription_cancelled', (data) => {
        console.log('Subscription cancelled:', data);
        this.triggerCallback('subscription_cancelled', data);
      });

      // Business events
      this.socket.on('order_update', (event: RealTimeEvent) => {
        console.log('Order update received:', event);
        this.triggerCallback('order_update', event);
      });

      this.socket.on('inventory_update', (event: RealTimeEvent) => {
        console.log('Inventory update received:', event);
        this.triggerCallback('inventory_update', event);
      });

      this.socket.on('inventory_alert', (event: RealTimeEvent) => {
        console.log('Inventory alert received:', event);
        this.triggerCallback('inventory_alert', event);
      });

      this.socket.on('user_notification', (event: RealTimeEvent) => {
        console.log('User notification received:', event);
        this.triggerCallback('user_notification', event);
      });

      this.socket.on('system_notification', (event: RealTimeEvent) => {
        console.log('System notification received:', event);
        this.triggerCallback('system_notification', event);
      });

      this.socket.on('role_notification', (event: RealTimeEvent) => {
        console.log('Role notification received:', event);
        this.triggerCallback('role_notification', event);
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Reconnect to WebSocket server
   */
  private reconnect(): void {
    if (this.token && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect(this.token).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected && this.socket?.authenticated || false;
  }

  /**
   * Subscribe to order updates
   */
  subscribeToOrders(): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Cannot subscribe to orders.');
      return;
    }
    this.socket!.emit('subscribe_to_orders');
  }

  /**
   * Subscribe to inventory updates
   */
  subscribeToInventory(): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Cannot subscribe to inventory.');
      return;
    }
    this.socket!.emit('subscribe_to_inventory');
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(type: 'order' | 'inventory'): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Cannot unsubscribe.');
      return;
    }
    this.socket!.emit('unsubscribe', { type });
  }

  /**
   * Send ping to server
   */
  ping(): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Cannot send ping.');
      return;
    }
    this.socket!.emit('ping');
  }

  /**
   * Register event callback
   */
  on(event: string, callback: WebSocketEventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * Unregister event callback
   */
  off(event: string, callback: WebSocketEventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Trigger event callbacks
   */
  private triggerCallback(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in callback for event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): number | undefined {
    return this.socket?.userId;
  }

  /**
   * Get current user role
   */
  getCurrentUserRole(): string | undefined {
    return this.socket?.userRole;
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): { connected: boolean; userId?: number; userRole?: string } {
    return {
      connected: this.isConnected(),
      userId: this.getCurrentUserId(),
      userRole: this.getCurrentUserRole(),
    };
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();