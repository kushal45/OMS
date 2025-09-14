# WebSocket Testing Guide - Step-by-Step Instructions

This guide provides detailed testing instructions for the OMS WebSocket integration with architectural clarity and practical examples.

## 🎯 Quick Start

### 1. **One-Command Startup**

```bash
# Navigate to OMS root directory
cd /Users/kushalbhattacharya/Documents/PersonalProjects/OMS

# Run the quick start script
./scripts/start-websocket-system.sh start
```

The script will:
- ✅ Check prerequisites (Node.js, npm)
- ✅ Install missing dependencies
- ✅ Create environment files
- ✅ Start all services in the correct order
- ✅ Verify service health
- ✅ Display system status

### 2. **Manual System Status Check**

```bash
# Check current system status
./scripts/start-websocket-system.sh status
```

Expected output:
```
================================================
 System Status 
================================================
Service Status:
  ✓ API Gateway (WebSocket): http://localhost:3000
  ✓ Order Service: http://localhost:3002
  ✓ Auth Service: http://localhost:3001
  ✓ Frontend Client: http://localhost:3001

WebSocket Endpoints:
  • WebSocket: ws://localhost:3000/events
  • Health Check: http://localhost:3000/websocket/health
  • Connection Stats: http://localhost:3000/websocket/stats
```

---

## 🧪 Complete Testing Flow

### **Phase 1: Service Verification**

#### 1.1 Verify API Gateway Health

```bash
# Basic health check
curl -X GET http://localhost:3000/websocket/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "stats": {
    "connectedClients": 0,
    "authenticatedUsers": 0,
    "onlineUsers": [],
    "rooms": {}
  }
}
```

#### 1.2 Verify WebSocket Connection

```bash
# Install wscat if not available
npm install -g wscat

# Test raw WebSocket connection (will fail without auth)
wscat -c "ws://localhost:3000/events"
# Should receive: {"message": "Authentication token required"}

# Test with sample token (Admin User)
wscat -c "ws://localhost:3000/events" \
  --auth "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJJZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxNjMwMDg2NDAwfQ.dummy"
```

### **Phase 2: Frontend Client Testing**

#### 2.1 Open Frontend Application

```bash
# Frontend should be running at:
open http://localhost:3001
```

#### 2.2 Frontend Connection Flow

1. **Authentication**:
   - Click "Admin User" sample token button
   - Or paste your JWT token
   - Click "Connect to WebSocket"
   - Verify green "Connected" status

2. **Subscribe to Events**:
   - Toggle "Order Updates" switch → ON
   - Toggle "Inventory Alerts" switch → ON
   - Verify subscription confirmations appear

3. **Visual Verification**:
   - Connection status shows green "Connected"
   - User ID and role displayed in chips
   - Subscription controls are active

### **Phase 3: Real-Time Event Testing**

#### 3.1 Order Creation Events

**Test 1: Basic Order Creation**

```bash
curl -X POST http://localhost:3000/websocket/notifications/order-created \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "123",
    "aliasId": "ORDER-2023-001",
    "userId": 1,
    "totalAmount": 99.99,
    "status": "created"
  }'
```

**Expected Frontend Behavior**:
- Toast notification: "Order ORDER-2023-001: created"
- Order tab shows badge with "1"
- Event appears in Orders tab
- Event details expandable with JSON view

**Test 2: Order Status Update**

```bash
curl -X POST http://localhost:3000/websocket/notifications/order-status-update \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "123",
    "aliasId": "ORDER-2023-001",
    "userId": 1,
    "newStatus": "shipped",
    "previousStatus": "created",
    "message": "Order has been shipped and is on its way"
  }'
```

**Expected Frontend Behavior**:
- Toast notification: "Order ORDER-2023-001: shipped"
- New event appears in Orders tab
- Status chip shows "SHIPPED" in blue

#### 3.2 Inventory Alert Events

**Test 3: Low Stock Alert**

```bash
curl -X POST http://localhost:3000/websocket/notifications/inventory-alert \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 101,
    "productName": "Premium Widget",
    "currentQuantity": 5,
    "threshold": 10,
    "alertType": "low_stock"
  }'
```

**Expected Frontend Behavior**:
- Toast notification: "Product 101 is low in stock (5)"
- Inventory tab shows badge with "1"
- Warning-colored event in Inventory tab

**Test 4: Out of Stock Alert**

```bash
curl -X POST http://localhost:3000/websocket/notifications/inventory-alert \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 102,
    "productName": "Essential Tool",
    "alertType": "out_of_stock"
  }'
```

**Expected Frontend Behavior**:
- Red toast notification: "Product 102 is out of stock!"
- Error-colored event in Inventory tab

**Test 5: Restocking Alert**

```bash
curl -X POST http://localhost:3000/websocket/notifications/inventory-alert \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 103,
    "productName": "Popular Item",
    "newQuantity": 50,
    "alertType": "restocked"
  }'
```

**Expected Frontend Behavior**:
- Green toast notification: "Product 103 has been restocked!"
- Success-colored event in Inventory tab

#### 3.3 System Notifications

**Test 6: System-Wide Broadcast**

```bash
curl -X POST http://localhost:3000/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system",
    "title": "System Maintenance Alert",
    "message": "Scheduled maintenance will begin at 2 AM UTC tonight",
    "data": {
      "maintenanceWindow": "2023-12-01T02:00:00Z to 2023-12-01T04:00:00Z",
      "expectedDowntime": "2 hours",
      "affectedServices": ["Order Processing", "Inventory Updates"]
    }
  }'
```

**Expected Frontend Behavior**:
- Toast notification with system message
- Notification appears in Notifications tab
- System-type chip displayed

**Test 7: Role-Based Notification**

```bash
curl -X POST http://localhost:3000/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "type": "role",
    "targetRole": "admin",
    "title": "Admin Alert",
    "message": "Multiple low stock alerts require attention",
    "data": {
      "alertCount": 5,
      "urgentItems": ["Widget A", "Tool B", "Component C"],
      "action": "review_inventory"
    }
  }'
```

**Expected Frontend Behavior**:
- Only visible to Admin users
- Role-specific notification styling
- Administrative alert icon

**Test 8: User-Specific Notification**

```bash
curl -X POST http://localhost:3000/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user",
    "targetUserId": 1,
    "title": "Account Update",
    "message": "Your profile has been updated successfully",
    "data": {
      "changedFields": ["email", "preferences"],
      "updateTime": "2023-12-01T12:00:00Z"
    }
  }'
```

### **Phase 4: Connection Management Testing**

#### 4.1 Ping/Pong Testing

**In Frontend Client**:
- Click the "Ping" button (clock icon)
- Verify "Ping sent to server" snackbar
- Check "Last ping" timestamp updates

**Via Command Line**:
```bash
# Using wscat (keep connection open from Phase 2.1)
ping
# Should receive: {"event": "pong", "data": {...}}
```

#### 4.2 Subscription Management

**In Frontend Client**:
- Toggle subscriptions ON/OFF
- Verify subscription confirmations
- Test that events only appear for subscribed types

#### 4.3 Connection Recovery Testing

**Test Connection Resilience**:

```bash
# Stop API Gateway briefly to test auto-reconnection
pkill -f "api-gateway"

# Wait 5 seconds, then restart
cd /Users/kushalbhattacharya/Documents/PersonalProjects/OMS/apps/api-gateway
npm run start:dev &
```

**Expected Frontend Behavior**:
- Status changes to "Disconnected" (red)
- Auto-reconnection attempts shown
- Status returns to "Connected" (green) when service restarts

---

## 🔍 Advanced Testing Scenarios

### **Scenario 1: Multi-User Testing**

Open multiple browser tabs/windows:

1. **Tab 1**: Admin User (userId: 1)
2. **Tab 2**: Customer User (userId: 2)  
3. **Tab 3**: Staff User (userId: 3)

**Test User-Specific Events**:

```bash
# Send notification to specific user (should only appear in Tab 2)
curl -X POST http://localhost:3000/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user",
    "targetUserId": 2,
    "title": "Your Order Update",
    "message": "Order ORDER-456 has been confirmed"
  }'
```

### **Scenario 2: High-Volume Event Testing**

**Bulk Event Generation Script**:

```bash
#!/bin/bash
# Generate 10 order events rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/websocket/notifications/order-created \
    -H "Content-Type: application/json" \
    -d "{
      \"orderId\": \"$i\",
      \"aliasId\": \"BULK-ORDER-$i\",
      \"userId\": 1,
      \"totalAmount\": $(echo "$i * 10.99" | bc),
      \"status\": \"created\"
    }" &
done
wait
```

**Expected Behavior**:
- All events appear in frontend
- Toast notifications may be throttled
- Event list shows all 10 orders
- No memory leaks or performance issues

### **Scenario 3: Error Handling Testing**

**Invalid Event Data**:

```bash
# Send malformed JSON
curl -X POST http://localhost:3000/websocket/notifications/order-created \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Expected: Error response, frontend remains stable
```

**Authentication Errors**:

```bash
# Invalid JWT token
curl -X POST http://localhost:3000/websocket/broadcast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{"type": "system", "title": "Test", "message": "Test"}'

# Expected: 401 Unauthorized
```

---

## 📊 Performance Testing

### **Connection Limits Testing**

```javascript
// Browser console script to test multiple connections
const connections = [];
for (let i = 0; i < 50; i++) {
  const socket = io('ws://localhost:3000/events', {
    auth: { token: 'your_jwt_token' }
  });
  connections.push(socket);
}
console.log(`Created ${connections.length} connections`);
```

### **Event Throughput Testing**

```bash
# Apache Bench (ab) testing for REST endpoints
ab -n 100 -c 10 -H "Content-Type: application/json" \
   -p test-order.json \
   http://localhost:3000/websocket/notifications/order-created

# Where test-order.json contains:
{
  "orderId": "test",
  "aliasId": "PERF-TEST",
  "userId": 1,
  "totalAmount": 99.99,
  "status": "created"
}
```

---

## 🔧 Debugging and Monitoring

### **Frontend Debugging**

**Browser Developer Tools**:
1. Open DevTools (F12)
2. Navigate to Console tab
3. Look for WebSocket connection logs:

```javascript
// Expected logs:
Connected to OMS WebSocket: {userId: 1, timestamp: "..."}
Subscription confirmed: {type: "order_updates", message: "..."}
Order update received: {type: "order_status", data: {...}}
```

**Network Tab Monitoring**:
1. Filter by "WS" (WebSocket)
2. Monitor connection status and message flow
3. Check for connection drops or errors

### **Backend Debugging**

**API Gateway Logs**:
```bash
# Monitor real-time logs
tail -f /tmp/api-gateway.log

# Expected log patterns:
[WebSocket] Client attempting to connect: socket_id
[WebSocket] Client authenticated as user 1 with role admin
[WebSocket] Broadcasting order update for order ORDER-123
```

**Service Health Monitoring**:
```bash
# Connection statistics
curl http://localhost:3000/websocket/stats

# Response:
{
  "connectedClients": 3,
  "authenticatedUsers": 2,
  "onlineUsers": [1, 2],
  "rooms": {
    "user_1": 1,
    "user_2": 1,
    "role_admin": 1,
    "order_updates": 2
  }
}
```

---

## 📋 Testing Checklist

### **Basic Functionality** ✅

- [ ] API Gateway starts and serves WebSocket endpoint
- [ ] Frontend client loads and displays interface
- [ ] JWT authentication works with sample tokens
- [ ] WebSocket connection establishes successfully
- [ ] Connection status indicator works correctly
- [ ] Subscription toggles function properly

### **Event Handling** ✅

- [ ] Order creation events appear in real-time
- [ ] Order status updates display correctly
- [ ] Inventory alerts show appropriate severity
- [ ] System notifications broadcast to all users
- [ ] User-specific notifications target correctly
- [ ] Role-based notifications filter properly

### **UI/UX Features** ✅

- [ ] Toast notifications appear for events
- [ ] Event tabs show correct badge counts
- [ ] Event details expand with JSON view
- [ ] Dark/light theme toggle works
- [ ] Responsive design on mobile devices
- [ ] Event history persists during session

### **Error Handling** ✅

- [ ] Invalid JWT tokens rejected gracefully
- [ ] Network disconnections trigger auto-reconnect
- [ ] Malformed event data handled without crashes
- [ ] Authentication failures show clear messages
- [ ] Service unavailability handled gracefully

### **Performance** ✅

- [ ] Multiple simultaneous connections work
- [ ] High-volume events don't cause memory leaks
- [ ] Event throttling prevents UI freezing
- [ ] Connection recovery works after service restart
- [ ] No significant latency in event delivery

---

## 🎯 Success Criteria

Your WebSocket integration is working correctly when:

1. **✅ Connection Management**:
   - Clean connection/disconnection
   - Auto-reconnection after interruptions
   - Proper authentication and authorization

2. **✅ Real-Time Communication**:
   - Sub-second event delivery
   - No lost events during normal operation
   - Proper event routing to subscribed users

3. **✅ User Experience**:
   - Intuitive interface with clear visual feedback
   - Responsive design across devices
   - Reliable toast notifications and event display

4. **✅ System Reliability**:
   - No memory leaks during extended use
   - Graceful handling of service interruptions
   - Comprehensive error reporting and recovery

---

## 🚀 Next Steps

After successful testing:

1. **Production Deployment**: Use the production deployment guide
2. **Integration**: Connect real Order/Inventory services
3. **Monitoring**: Set up production monitoring and alerting
4. **Scaling**: Configure load balancing for multiple instances

---

## 📞 Support

If you encounter issues:

1. **Check Service Status**: `./scripts/start-websocket-system.sh status`
2. **Review Logs**: Check `/tmp/*.log` files
3. **Verify Configuration**: Confirm `.env` files are correct
4. **Test Connectivity**: Use `curl` commands to verify endpoints
5. **Browser Console**: Check for JavaScript errors or WebSocket issues

The WebSocket integration provides a robust foundation for real-time communication in your OMS system! 🎉