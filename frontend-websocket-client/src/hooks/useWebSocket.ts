import { useEffect, useState, useCallback, useRef } from 'react';
import { webSocketService, RealTimeEvent, OrderStatusUpdate, InventoryUpdate, UserNotification } from '../services/websocket.service';

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  userId?: number;
  userRole?: string;
}

export interface UseWebSocketReturn {
  // Connection state
  state: WebSocketState;
  
  // Connection methods
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  
  // Subscription methods
  subscribeToOrders: () => void;
  subscribeToInventory: () => void;
  unsubscribeFromOrders: () => void;
  unsubscribeFromInventory: () => void;
  
  // Utility methods
  ping: () => void;
  
  // Event data
  notifications: UserNotification[];
  orderUpdates: OrderStatusUpdate[];
  inventoryUpdates: InventoryUpdate[];
  
  // Clear methods
  clearNotifications: () => void;
  clearOrderUpdates: () => void;
  clearInventoryUpdates: () => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [orderUpdates, setOrderUpdates] = useState<OrderStatusUpdate[]>([]);
  const [inventoryUpdates, setInventoryUpdates] = useState<InventoryUpdate[]>([]);

  // Use refs to store callback functions to avoid re-registering
  const callbackRefs = useRef<{ [key: string]: (data: any) => void }>({});

  // Connection callback
  const onConnected = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      connected: true,
      connecting: false,
      error: null,
      userId: data.userId,
    }));
  }, []);

  // Disconnection callback
  const onDisconnected = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      error: data.reason || 'Connection lost',
    }));
  }, []);

  // Error callbacks
  const onConnectionError = useCallback((error: any) => {
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      error: `Connection error: ${error.message || error}`,
    }));
  }, []);

  const onAuthError = useCallback((error: any) => {
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      error: `Authentication error: ${error.message || error}`,
    }));
  }, []);

  // Business event callbacks
  const onOrderUpdate = useCallback((event: RealTimeEvent) => {
    const orderUpdate = event.data as OrderStatusUpdate;
    setOrderUpdates(prev => [orderUpdate, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  const onInventoryUpdate = useCallback((event: RealTimeEvent) => {
    const inventoryUpdate = event.data as InventoryUpdate;
    setInventoryUpdates(prev => [inventoryUpdate, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  const onInventoryAlert = useCallback((event: RealTimeEvent) => {
    const inventoryUpdate = event.data as InventoryUpdate;
    setInventoryUpdates(prev => [inventoryUpdate, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  const onUserNotification = useCallback((event: RealTimeEvent) => {
    const notification = event.data as UserNotification;
    setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep last 100
  }, []);

  const onSystemNotification = useCallback((event: RealTimeEvent) => {
    const notification = event.data as UserNotification;
    setNotifications(prev => [{ ...notification, type: 'system' }, ...prev.slice(0, 99)]);
  }, []);

  const onRoleNotification = useCallback((event: RealTimeEvent) => {
    const notification = event.data as UserNotification;
    setNotifications(prev => [{ ...notification, type: 'role' }, ...prev.slice(0, 99)]);
  }, []);

  // Store callbacks in refs
  useEffect(() => {
    callbackRefs.current = {
      connected: onConnected,
      disconnected: onDisconnected,
      connect_error: onConnectionError,
      auth_error: onAuthError,
      order_update: onOrderUpdate,
      inventory_update: onInventoryUpdate,
      inventory_alert: onInventoryAlert,
      user_notification: onUserNotification,
      system_notification: onSystemNotification,
      role_notification: onRoleNotification,
    };
  }, [
    onConnected,
    onDisconnected,
    onConnectionError,
    onAuthError,
    onOrderUpdate,
    onInventoryUpdate,
    onInventoryAlert,
    onUserNotification,
    onSystemNotification,
    onRoleNotification,
  ]);

  // Register event listeners
  useEffect(() => {
    const callbacks = callbackRefs.current;
    
    Object.entries(callbacks).forEach(([event, callback]) => {
      webSocketService.on(event, callback);
    });

    // Cleanup function
    return () => {
      Object.entries(callbacks).forEach(([event, callback]) => {
        webSocketService.off(event, callback);
      });
    };
  }, []); // Empty dependency array since callbacks are stored in refs

  // Connection methods
  const connect = useCallback(async (token: string): Promise<void> => {
    setState(prev => ({ ...prev, connecting: true, error: null }));
    
    try {
      await webSocketService.connect(token);
    } catch (error) {
      // Error will be handled by the error callbacks
    }
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
    setState({
      connected: false,
      connecting: false,
      error: null,
    });
  }, []);

  // Subscription methods
  const subscribeToOrders = useCallback(() => {
    webSocketService.subscribeToOrders();
  }, []);

  const subscribeToInventory = useCallback(() => {
    webSocketService.subscribeToInventory();
  }, []);

  const unsubscribeFromOrders = useCallback(() => {
    webSocketService.unsubscribe('order');
  }, []);

  const unsubscribeFromInventory = useCallback(() => {
    webSocketService.unsubscribe('inventory');
  }, []);

  // Utility methods
  const ping = useCallback(() => {
    webSocketService.ping();
  }, []);

  // Clear methods
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearOrderUpdates = useCallback(() => {
    setOrderUpdates([]);
  }, []);

  const clearInventoryUpdates = useCallback(() => {
    setInventoryUpdates([]);
  }, []);

  return {
    state,
    connect,
    disconnect,
    subscribeToOrders,
    subscribeToInventory,
    unsubscribeFromOrders,
    unsubscribeFromInventory,
    ping,
    notifications,
    orderUpdates,
    inventoryUpdates,
    clearNotifications,
    clearOrderUpdates,
    clearInventoryUpdates,
  };
};