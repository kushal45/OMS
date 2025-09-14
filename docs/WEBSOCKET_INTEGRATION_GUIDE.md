# WebSocket Integration Guide for OMS

This document provides comprehensive guidance on the WebSocket functionality integrated into the OMS (Order Management System) monorepo.

## Overview

The WebSocket functionality has been integrated into the **API Gateway** to provide real-time communication capabilities across the entire OMS system. This architecture allows for:

- Real-time order status updates
- Inventory alerts and notifications  
- System-wide announcements
- User-specific notifications
- Role-based messaging

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Microservices  │
│   Client        │◄──►│   WebSocket     │◄──►│   (Order,       │
│                 │    │   Server        │    │   Inventory,    │
│                 │    │                 │    │   etc.)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   Authentication│
                        │   & Authorization│
                        └─────────────────┘
```

## Why API Gateway was Chosen

### ✅ **Advantages of API Gateway Integration**

1. **Single Entry Point**: Clients only need to connect to one WebSocket endpoint
2. **Centralized Authentication**: Leverages existing JWT authentication infrastructure  
3. **Unified CORS Management**: Single point for cross-origin request handling
4. **Service Coordination**: Can aggregate events from multiple microservices
5. **Load Balancing**: Can be easily scaled horizontally
6. **Security**: Single point for implementing rate limiting and security policies

### ❌ **Why Other Options Were Not Chosen**

**Individual Service Integration**: Would require clients to maintain multiple connections
**Dedicated Real-Time Service**: Adds unnecessary complexity for current requirements
**Message Queue Integration**: Over-engineered for simple notification requirements

## Features

### 🔐 **Authentication & Authorization**

- JWT token-based authentication
- Automatic user identification and role assignment
- Room-based access control (user-specific, role-specific)

### 📡 **Real-Time Events**

- **Order Updates**: Creation, status changes, cancellations
- **Inventory Alerts**: Low stock, out of stock, restocked notifications
- **System Notifications**: Maintenance, announcements
- **User Notifications**: Personal messages, account updates

### 🏠 **Room Management**

- `user_{userId}`: Personal user rooms
- `role_{roleName}`: Role-based rooms (admin, staff, customer)
- `order_updates`: Order update subscriptions
- `inventory_updates`: Inventory alert subscriptions

## API Endpoints

### WebSocket Connection

```javascript
// Connection URL
ws://localhost:3000/events

// Authentication
{
  auth: {
    token: "your-jwt-token"
  }
}
```

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/websocket/stats` | GET | Connection statistics |
| `/websocket/users/{userId}/online` | GET | Check if user is online |
| `/websocket/users/online` | GET | List of online users |
| `/websocket/broadcast` | POST | Broadcast notification |
| `/websocket/notifications/order-created` | POST | Notify order creation |
| `/websocket/notifications/order-status-update` | POST | Notify order status update |
| `/websocket/notifications/inventory-alert` | POST | Send inventory alert |
| `/websocket/health` | GET | Health check |

## Client Integration

### JavaScript/TypeScript Client Example

```javascript
import { io } from 'socket.io-client';

class OMSWebSocketClient {
  constructor(token) {
    this.socket = io('ws://localhost:3000/events', {
      auth: { token }
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Connection events
    this.socket.on('connected', (data) => {
      console.log('Connected to OMS WebSocket:', data);
    });
    
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Business events
    this.socket.on('order_update', (event) => {
      console.log('Order update received:', event);
      this.handleOrderUpdate(event.data);
    });
    
    this.socket.on('inventory_update', (event) => {
      console.log('Inventory update received:', event);
      this.handleInventoryUpdate(event.data);
    });
    
    this.socket.on('user_notification', (event) => {
      console.log('User notification:', event);
      this.handleUserNotification(event.data);
    });
  }
  
  // Subscribe to order updates
  subscribeToOrders() {
    this.socket.emit('subscribe_to_orders');
  }
  
  // Subscribe to inventory updates
  subscribeToInventory() {
    this.socket.emit('subscribe_to_inventory');
  }
  
  // Ping server
  ping() {
    this.socket.emit('ping');
  }
  
  handleOrderUpdate(data) {
    // Implement your order update UI logic
    if (data.status === 'shipped') {
      this.showNotification(`Order ${data.aliasId} has been shipped!`);
    }
  }
  
  handleInventoryUpdate(data) {
    // Implement your inventory update UI logic
    if (data.status === 'low_stock') {
      this.showWarning(`Low stock alert for product ${data.productId}`);
    }
  }
  
  handleUserNotification(data) {
    // Implement your user notification UI logic
    this.showNotification(data.title, data.message);
  }
}

// Usage
const client = new OMSWebSocketClient('your-jwt-token');
client.subscribeToOrders();
client.subscribeToInventory();
```

### React Hook Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const useOMSWebSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    if (!token) return;
    
    const newSocket = io('ws://localhost:3000/events', {
      auth: { token }
    });
    
    newSocket.on('connected', () => {
      setConnected(true);
      setSocket(newSocket);
    });
    
    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    newSocket.on('order_update', (event) => {
      setNotifications(prev => [...prev, {
        type: 'order',
        data: event.data,
        timestamp: new Date()
      }]);
    });
    
    newSocket.on('user_notification', (event) => {
      setNotifications(prev => [...prev, {
        type: 'notification',
        data: event.data,
        timestamp: new Date()
      }]);
    });
    
    return () => {
      newSocket.close();
    };
  }, [token]);
  
  const subscribeToOrders = () => {
    socket?.emit('subscribe_to_orders');
  };
  
  const subscribeToInventory = () => {
    socket?.emit('subscribe_to_inventory');
  };
  
  return {
    connected,
    notifications,
    subscribeToOrders,
    subscribeToInventory
  };
};
```

## Service Integration

### Order Service Integration

```javascript
// In your order service
import { WebSocketClientService } from '@lib/websocket-client';

@Injectable()
export class OrderService {
  constructor(
    private readonly webSocketClient: WebSocketClientService,
    // ... other dependencies
  ) {}
  
  async createOrder(orderData) {
    // Create order logic
    const order = await this.orderRepository.save(orderData);
    
    // Trigger WebSocket notification
    await this.webSocketClient.notifyOrderCreated({
      orderId: order.id,
      aliasId: order.aliasId,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
    });
    
    return order;
  }
  
  async updateOrderStatus(orderId, newStatus) {
    // Update order logic
    const order = await this.orderRepository.findOne(orderId);
    const previousStatus = order.status;
    order.status = newStatus;
    await this.orderRepository.save(order);
    
    // Trigger WebSocket notification
    await this.webSocketClient.notifyOrderStatusUpdate({
      orderId: order.id,
      aliasId: order.aliasId,
      userId: order.userId,
      newStatus: newStatus,
      previousStatus: previousStatus,
      message: `Order status updated from ${previousStatus} to ${newStatus}`,
    });
    
    return order;
  }
}
```

### Inventory Service Integration

```javascript
// In your inventory service
import { WebSocketClientService } from '@lib/websocket-client';

@Injectable()
export class InventoryService {
  constructor(
    private readonly webSocketClient: WebSocketClientService,
    // ... other dependencies
  ) {}
  
  async updateInventory(productId, newQuantity) {
    // Get current inventory
    const inventory = await this.inventoryRepository.findOne({ productId });
    const previousQuantity = inventory.quantity;
    
    // Update inventory
    inventory.quantity = newQuantity;
    await this.inventoryRepository.save(inventory);
    
    // Trigger WebSocket notifications based on quantity changes
    await this.webSocketClient.triggerInventoryNotifications({
      productId: inventory.productId,
      productName: inventory.product.name,
      currentQuantity: newQuantity,
      previousQuantity: previousQuantity,
      threshold: inventory.lowStockThreshold,
    });
    
    return inventory;
  }
}
```

## Event Types and Payloads

### Order Events

```javascript
// Order Creation
{
  type: 'order_status',
  data: {
    orderId: '123',
    aliasId: 'ORDER-456',
    status: 'created',
    userId: 789,
    timestamp: '2023-12-01T12:00:00Z',
    message: 'Order created successfully'
  },
  userId: 789,
  timestamp: '2023-12-01T12:00:00Z'
}

// Order Status Update
{
  type: 'order_status',
  data: {
    orderId: '123',
    aliasId: 'ORDER-456',
    status: 'shipped',
    userId: 789,
    timestamp: '2023-12-01T12:30:00Z',
    message: 'Order has been shipped'
  },
  userId: 789,
  timestamp: '2023-12-01T12:30:00Z'
}
```

### Inventory Events

```javascript
// Low Stock Alert
{
  type: 'inventory_update',
  data: {
    productId: 101,
    quantity: 5,
    status: 'low_stock',
    threshold: 10,
    timestamp: '2023-12-01T12:00:00Z'
  },
  timestamp: '2023-12-01T12:00:00Z'
}

// Out of Stock Alert
{
  type: 'inventory_update',
  data: {
    productId: 102,
    quantity: 0,
    status: 'out_of_stock',
    timestamp: '2023-12-01T12:15:00Z'
  },
  timestamp: '2023-12-01T12:15:00Z'
}

// Restocked Alert
{
  type: 'inventory_update',
  data: {
    productId: 103,
    quantity: 50,
    status: 'restocked',
    timestamp: '2023-12-01T12:45:00Z'
  },
  timestamp: '2023-12-01T12:45:00Z'
}
```

### User Notifications

```javascript
// User-Specific Notification
{
  type: 'user_specific',
  data: {
    type: 'order_created',
    title: 'Order Created Successfully',
    message: 'Your order ORDER-456 has been created successfully',
    data: {
      orderId: '123',
      aliasId: 'ORDER-456',
      totalAmount: 99.99
    }
  },
  userId: 789,
  timestamp: '2023-12-01T12:00:00Z'
}
```

## Configuration

### Environment Variables

```bash
# WebSocket Configuration
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# API Gateway URL for service-to-service communication
API_GATEWAY_URL=http://gateway:3000
```

### TypeScript Paths

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@lib/websocket-client": ["libs/websocket-client/src"],
      "@lib/websocket-client/*": ["libs/websocket-client/src/*"]
    }
  }
}
```

## Testing

### WebSocket Connection Test

```bash
# Test WebSocket connection
curl -X GET http://localhost:3000/websocket/health
```

### Manual Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/events" -H "Authorization: Bearer your-jwt-token"

# Send ping
ping

# Subscribe to orders
subscribe_to_orders
```

### Integration Testing

```javascript
// Jest test example
describe('WebSocket Integration', () => {
  let webSocketClient;
  
  beforeEach(() => {
    webSocketClient = new WebSocketClientService(httpService, configService);
  });
  
  it('should notify order creation', async () => {
    const orderData = {
      orderId: '123',
      aliasId: 'ORDER-456',
      userId: 789,
      totalAmount: 99.99,
      status: 'created'
    };
    
    const result = await webSocketClient.notifyOrderCreated(orderData);
    expect(result).toBe(true);
  });
});
```

## Monitoring and Troubleshooting

### Health Check Endpoint

```bash
GET /websocket/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2023-12-01T12:00:00Z",
  "stats": {
    "connectedClients": 25,
    "authenticatedUsers": 20,
    "onlineUsers": [1, 2, 3, 4, 5],
    "rooms": {
      "user_1": 1,
      "role_admin": 3,
      "order_updates": 15
    }
  }
}
```

### Connection Statistics

```bash
GET /websocket/stats
```

### Logs to Monitor

- WebSocket Gateway initialization
- Client connections and disconnections
- Authentication failures
- Message broadcasting logs
- Error logs for failed notifications

## Security Considerations

1. **Authentication**: JWT tokens are required for WebSocket connections
2. **Authorization**: Room-based access control prevents unauthorized access
3. **Rate Limiting**: Consider implementing rate limiting for WebSocket events
4. **CORS**: Properly configure CORS origins for production
5. **Token Expiration**: Handle JWT token expiration gracefully

## Performance Considerations

1. **Connection Limits**: Monitor and limit concurrent connections
2. **Memory Usage**: Track memory usage for connection tracking
3. **Message Queuing**: Consider implementing message queuing for high-volume events
4. **Horizontal Scaling**: Plan for Redis adapter for multi-instance deployments

## Deployment

### Docker Configuration

Update `docker-compose.app.yml`:

```yaml
gateway:
  # ... existing configuration
  environment:
    - CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
    - JWT_SECRET=your-production-jwt-secret
  ports:
    - "3000:3000"  # HTTP and WebSocket traffic
```

### Production Considerations

1. **Load Balancer**: Configure load balancer for sticky sessions or use Redis adapter
2. **SSL/TLS**: Enable WebSocket Secure (WSS) in production
3. **Monitoring**: Set up monitoring for WebSocket connections and performance
4. **Logging**: Implement structured logging for WebSocket events

## Future Enhancements

1. **Message Persistence**: Store missed messages for offline users
2. **Typing Indicators**: Real-time typing indicators for chat features
3. **Presence System**: Enhanced user presence tracking
4. **Message History**: WebSocket message history and replay functionality
5. **Custom Channels**: Dynamic channel creation for specific business contexts

## Support and Troubleshooting

### Common Issues

1. **Connection Refused**: Check API Gateway is running and port 3000 is accessible
2. **Authentication Failed**: Verify JWT token is valid and not expired
3. **No Events Received**: Check subscription to appropriate rooms/events
4. **CORS Errors**: Verify CORS_ORIGIN environment variable includes client origin

### Getting Help

1. Check application logs for WebSocket-related errors
2. Use the health check endpoint to verify service status
3. Test connection with wscat for debugging
4. Review WebSocket client implementation for proper event handling