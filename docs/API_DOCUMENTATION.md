# OMS (Order Management System) API Documentation

## Overview

The OMS system consists of multiple microservices exposed through an API Gateway. This documentation covers all endpoints for Auth, Order, Cart, and Address services with comprehensive request/response examples.

## Base URLs

- **API Gateway**: `http://localhost:3000`
- **Auth Service (Direct)**: `http://localhost:3001` 
- **Order Service (Direct)**: `http://localhost:3002`
- **Cart Service (Direct)**: `http://localhost:3003`

## Gateway Routing

The API Gateway routes requests as follows:
- `/auth/*` → Auth Service (`http://auth:3001`)
- `/order/*` → Order Service (`http://order:3002`)
- Cart service is accessed directly (not routed through gateway)

## Authentication

### JWT Token Requirements
- **Public Routes**: `/auth/login`, `/auth/register`, `/auth/validate-token`
- **Protected Routes**: All other endpoints require `Authorization: Bearer <token>`
- **Gateway Middleware**: Validates JWT tokens and adds user data to request headers

### Rate Limiting
- **TTL**: 60 seconds
- **Limit**: 20 requests per TTL window

---

## 🔐 AUTH SERVICE ENDPOINTS

### 1. Register Customer
**Endpoint**: `POST /auth/register`  
**Gateway URL**: `http://localhost:3000/auth/register`  
**Authentication**: Public

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Customer registered successfully",
  "data": {
    "id": "uuid-customer-id",
    "name": "John Doe",
    "email": "john.doe@example.com"
  }
}
```

### 2. Login Customer
**Endpoint**: `POST /auth/login`  
**Gateway URL**: `http://localhost:3000/auth/login`  
**Authentication**: Public

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Validate Token
**Endpoint**: `POST /auth/validate-token`  
**Gateway URL**: `http://localhost:3000/auth/validate-token`  
**Authentication**: Public

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200):
```json
{
  "email": "john.doe@example.com",
  "id": "uuid-customer-id",
  "name": "John Doe"
}
```

### 4. Logout Customer
**Endpoint**: `POST /auth/logout`  
**Gateway URL**: `http://localhost:3000/auth/logout`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Logout successful"
}
```

### 5. Update Customer Profile
**Endpoint**: `PUT /auth/profile`  
**Gateway URL**: `http://localhost:3000/auth/profile`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "phoneNumber": "+1234567890",
  "countryCode": "+1"
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-customer-id",
    "name": "John Updated",
    "email": "john.updated@example.com",
    "phoneNumber": "+1234567890",
    "countryCode": "+1"
  }
}
```

---

## 📍 ADDRESS ENDPOINTS (Auth Service)

### 6. Create Address
**Endpoint**: `POST /auth/addresses`  
**Gateway URL**: `http://localhost:3000/auth/addresses`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "street": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "pincode": "10001"
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Address created successfully",
  "data": {
    "id": "address-uuid",
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "pincode": "10001"
  }
}
```

### 7. Update Address
**Endpoint**: `PUT /auth/addresses/{addressId}`  
**Gateway URL**: `http://localhost:3000/auth/addresses/123`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "street": "456 Updated Street",
  "city": "Los Angeles",
  "state": "CA",
  "country": "USA",
  "pincode": "90210"
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Address updated successfully",
  "data": {
    "id": "123",
    "street": "456 Updated Street",
    "city": "Los Angeles",
    "state": "CA",
    "country": "USA",
    "pincode": "90210"
  }
}
```

### 8. Delete Address
**Endpoint**: `DELETE /auth/addresses/{addressId}`  
**Gateway URL**: `http://localhost:3000/auth/addresses/123`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (204):
```json
{
  "status": "success",
  "message": "Address deleted successfully"
}
```

---

## 📦 ORDER SERVICE ENDPOINTS

### 9. Create Order (Cart-Based)
**Endpoint**: `POST /order/orders`
**Gateway URL**: `http://localhost:3000/order/orders`
**Authentication**: Bearer Token Required

**Description**: Creates an order from the user's active cart. The system automatically fetches items from the user's cart and creates the order.

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "addressId": 1
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Order created successfully",
  "data": {
    "aliasId": "123e4567-e89b-12d3-a456-426614174000",
    "orderStatus": "Pending",
    "totalAmount": 100.50,
    "tax": 10.05,
    "deliveryCharge": 15.00
  }
}
```

**Prerequisites**:
- User must have an active cart with items
- Cart items must be valid and in stock
- Address must exist and belong to the user

**Error Responses**:
```json
// Empty or missing cart
{
  "status": "error",
  "message": "Active cart is empty or not found.",
  "statusCode": 400
}

// Invalid address
{
  "status": "error",
  "message": "Address not valid",
  "statusCode": 400
}

// Inventory validation failed
{
  "status": "error",
  "message": "Order validation failed: insufficient inventory",
  "statusCode": 412
}
```

### 9b. Create Order (Direct Items) - Alternative Implementation
**Endpoint**: `POST /order/orders`
**Gateway URL**: `http://localhost:3000/order/orders`
**Authentication**: Bearer Token Required

**Description**: Alternative implementation that accepts order items directly in the request body (as used in tests).

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "addressId": 1,
  "orderItems": [
    {
      "productId": 1,
      "quantity": 2,
      "price": 25.99
    },
    {
      "productId": 2,
      "quantity": 1,
      "price": 45.50
    }
  ]
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Order created successfully",
  "data": {
    "aliasId": "123e4567-e89b-12d3-a456-426614174000",
    "orderStatus": "Pending",
    "totalAmount": 97.48,
    "tax": 9.75,
    "deliveryCharge": 15.00
  }
}
```

**Validation Rules for Order Items**:
- **productId**: Required, positive integer (minimum 1)
- **quantity**: Required, integer between 1-100
- **price**: Required, number between 1-10000

**Note**: This implementation requires updating the `OrderRequestDto` to include the `orderItems` field with proper validation.

### 10. Get Order by ID
**Endpoint**: `GET /order/{aliasId}`  
**Gateway URL**: `http://localhost:3000/order/123e4567-e89b-12d3-a456-426614174000`  
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Order fetched successfully",
  "data": {
    "id": 34,
    "aliasId": "f0482ce3-f5ed-4506-a598-c8b3df004261",
    "addressId": 9,
    "userId": 4,
    "orderStatus": "Pending",
    "totalAmount": 23.0,
    "deliveryCharge": 11.5,
    "tax": 2.33,
    "createdAt": "2024-12-01T08:04:47.612Z",
    "updatedAt": "2024-12-01T08:04:47.612Z",
    "address": {
      "id": 4,
      "name": "test",
      "email": "test1@gmail.com",
      "phoneNumber": "9513803371",
      "countryCode": "+92"
    },
    "user": {}
  }
}

### 11. Get All Orders
**Endpoint**: `GET /order/orders`
**Gateway URL**: `http://localhost:3000/order/orders`
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Orders fetched successfully",
  "data": [
    {
      "id": 34,
      "aliasId": "f0482ce3-f5ed-4506-a598-c8b3df004261",
      "addressId": 9,
      "userId": 4,
      "orderStatus": "Pending",
      "totalAmount": 23.0,
      "deliveryCharge": 11.5,
      "tax": 2.33,
      "createdAt": "2024-12-01T08:04:47.612Z",
      "updatedAt": "2024-12-01T08:04:47.612Z"
    }
  ]
}
```

### 12. Get Order Items
**Endpoint**: `GET /order/{aliasId}/orderItems`
**Gateway URL**: `http://localhost:3000/order/123e4567-e89b-12d3-a456-426614174000/orderItems`
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Order items fetched successfully",
  "data": [
    {
      "id": 1,
      "orderId": 1,
      "productId": 1,
      "quantity": 2,
      "price": 50.0,
      "creationDate": "2024-12-01T08:04:47.612Z",
      "updatedDate": "2024-12-01T08:04:47.612Z"
    }
  ]
}
```

### 13. Update Order
**Endpoint**: `PUT /order/{aliasId}`
**Gateway URL**: `http://localhost:3000/order/123e4567-e89b-12d3-a456-426614174000`
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "addressId": 9,
  "orderStatus": "Confirmed",
  "orderItems": [
    {
      "productId": 1,
      "quantity": 3,
      "price": 25.99
    },
    {
      "productId": 2,
      "quantity": 1,
      "price": 45.50
    }
  ]
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Order updated successfully",
  "data": {
    "aliasId": "123e4567-e89b-12d3-a456-426614174000",
    "orderStatus": "Confirmed",
    "totalAmount": 120.0,
    "tax": 12.0,
    "deliveryCharge": 15.00
  }
}
```

### 14. Cancel Order
**Endpoint**: `PUT /order/{aliasId}/cancel`
**Gateway URL**: `http://localhost:3000/order/123e4567-e89b-12d3-a456-426614174000/cancel`
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200):
```json
{
  "id": 34,
  "aliasId": "123e4567-e89b-12d3-a456-426614174000",
  "orderStatus": "Cancelled",
  "totalAmount": 23.0,
  "deliveryCharge": 11.5,
  "tax": 2.33,
  "createdAt": "2024-12-01T08:04:47.612Z",
  "updatedAt": "2024-12-01T08:04:47.612Z"
}
```

### 15. Delete Order
**Endpoint**: `DELETE /order/{id}`
**Gateway URL**: `http://localhost:3000/order/34`
**Authentication**: Bearer Token Required

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (204):
```json
{
  "status": "success",
  "message": "Order deleted successfully"
}
```

---

## 🛒 CART SERVICE ENDPOINTS

**Note**: Cart service is accessed directly, not through the API Gateway.

### 16. Get Cart by User ID
**Endpoint**: `GET /cart/user/{userId}`
**Direct URL**: `http://localhost:3003/cart/user/123`
**Authentication**: Not required (direct service call)

**Response** (200):
```json
{
  "status": "success",
  "message": "Cart fetched successfully",
  "data": {
    "id": 789,
    "userId": 123,
    "items": [
      {
        "productId": 456,
        "quantity": 2,
        "price": 25.99
      }
    ],
    "subTotal": 51.98,
    "totalItems": 2,
    "discount": 5.00,
    "tax": 4.16,
    "grandTotal": 51.14,
    "updatedAt": "2024-05-25T10:30:00Z"
  }
}
```

### 17. Add Item to Cart
**Endpoint**: `POST /cart/user/{userId}/item`
**Direct URL**: `http://localhost:3003/cart/user/123/item`
**Authentication**: Not required (direct service call)

**Request Body**:
```json
{
  "productId": 456,
  "quantity": 1
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Item added to cart successfully",
  "data": {
    "id": 789,
    "userId": 123,
    "items": [
      {
        "productId": 456,
        "quantity": 3,
        "price": 25.99
      }
    ],
    "subTotal": 77.97,
    "totalItems": 3,
    "grandTotal": 77.97
  }
}
```

### 18. Update Cart Item Quantity
**Endpoint**: `PUT /cart/user/{userId}/item/{itemId}`
**Direct URL**: `http://localhost:3003/cart/user/123/item/456`
**Authentication**: Not required (direct service call)

**Request Body**:
```json
{
  "quantity": 5
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Cart item updated successfully",
  "data": {
    "id": 789,
    "userId": 123,
    "items": [
      {
        "productId": 456,
        "quantity": 5,
        "price": 25.99
      }
    ],
    "subTotal": 129.95,
    "totalItems": 5,
    "grandTotal": 129.95
  }
}
```

### 19. Remove Item from Cart
**Endpoint**: `DELETE /cart/user/{userId}/item/{itemId}`
**Direct URL**: `http://localhost:3003/cart/user/123/item/456`
**Authentication**: Not required (direct service call)

**Response** (200):
```json
{
  "status": "success",
  "message": "Item removed from cart successfully",
  "data": {
    "id": 789,
    "userId": 123,
    "items": [],
    "subTotal": 0.0,
    "totalItems": 0,
    "grandTotal": 0.0
  }
}
```

### 20. Clear Cart
**Endpoint**: `DELETE /cart/user/{userId}`
**Direct URL**: `http://localhost:3003/cart/user/123`
**Authentication**: Not required (direct service call)

**Response** (204):
```json
{
  "status": "success",
  "message": "Cart cleared successfully"
}
```

---

## 🏥 HEALTH CHECK ENDPOINTS

### 21. API Gateway Health
**Endpoint**: `GET /api-gateway/health`
**URL**: `http://localhost:3000/api-gateway/health`
**Authentication**: Public

**Response** (200):
```
OK
```

### 22. Auth Service Health
**Endpoint**: `GET /auth/health`
**Gateway URL**: `http://localhost:3000/auth/health`
**Direct URL**: `http://localhost:3001/health`
**Authentication**: Public

**Response** (200):
```
OK
```

### 23. Order Service Health
**Endpoint**: `GET /order/health`
**Gateway URL**: `http://localhost:3000/order/health`
**Direct URL**: `http://localhost:3002/health`
**Authentication**: Public

**Response** (200):
```
OK
```

### 24. Cart Service Health
**Endpoint**: `GET /cart/health`
**Direct URL**: `http://localhost:3003/cart/health`
**Authentication**: Public

**Response** (200):
```
OK
```

---

## 📋 VALIDATION RULES

### Customer Registration/Update
- **name**: Required, non-empty string
- **email**: Required, valid email format
- **password**: Required, minimum 6 characters
- **phoneNumber**: Optional, valid phone number format
- **countryCode**: Optional, non-empty string

### Address Creation/Update
- **street**: Optional string
- **city**: Required, non-empty string
- **state**: Required, non-empty string
- **country**: Required, non-empty string
- **pincode**: Required, non-empty string

### Order Creation (Cart-Based)
- **addressId**: Required, positive integer
- **Prerequisites**:
  - User must have an active cart with items
  - All cart items must be valid and in stock
  - Address must exist and belong to the user

### Order Creation (Direct Items) - Alternative
- **addressId**: Required, positive integer
- **orderItems**: Required array of order items
  - **productId**: Required, positive integer (minimum 1)
  - **quantity**: Required, integer between 1-100
  - **price**: Required, number between 1-10000

### Order Update
- **addressId**: Required, positive integer
- **orderStatus**: Optional, enum values: `Pending`, `Reserved`, `Confirmed`, `Cancelled`, `Shipped`, `Delivered`
- **orderItems**: Required array of order items (for updates)
  - **productId**: Required, positive integer
  - **quantity**: Required, positive integer
  - **price**: Required, number between 1-10000

### Cart Operations
- **productId**: Required, positive integer (minimum 1)
- **quantity**: Required, integer between 1-100
- **price**: Optional, positive number (minimum 0.01)

---

## 🔧 ERROR RESPONSES

### Standard Error Format
```json
{
  "status": "error",
  "message": "Error description",
  "error": {
    "details": "Additional error information"
  }
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created
- **204**: No Content
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **404**: Not Found
- **422**: Unprocessable Entity
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error

---

## 🚀 TESTING WORKFLOW

### 1. Authentication Flow
1. Register a new customer: `POST /auth/register`
2. Login to get access token: `POST /auth/login`
3. Use token for protected endpoints: `Authorization: Bearer <token>`

### 2. Complete Order Flow (Recommended - Cart-Based)
1. **Authentication**: Login to get access token: `POST /auth/login`
2. **Address Setup**: Create customer address: `POST /auth/addresses`
3. **Cart Management**:
   - Add items to cart: `POST /cart/user/{userId}/item`
   - Update quantities if needed: `PUT /cart/user/{userId}/item/{itemId}`
   - Verify cart contents: `GET /cart/user/{userId}`
4. **Order Creation**: Create order from cart: `POST /order/orders` (only requires `addressId`)
5. **Order Management**:
   - Track order status: `GET /order/{aliasId}`
   - Update order if needed: `PUT /order/{aliasId}`
   - Cancel if necessary: `PUT /order/{aliasId}/cancel`

### 2b. Alternative Order Flow (Direct Items)
1. **Authentication**: Login to get access token: `POST /auth/login`
2. **Address Setup**: Create customer address: `POST /auth/addresses`
3. **Direct Order Creation**: Create order with items directly: `POST /order/orders`
   ```json
   {
     "addressId": 1,
     "orderItems": [
       {"productId": 1, "quantity": 2, "price": 25.99}
     ]
   }
   ```
4. **Order Management**: Same as cart-based flow

### 3. Cart Management Flow
1. Add multiple items: `POST /cart/user/{userId}/item`
2. Update quantities: `PUT /cart/user/{userId}/item/{itemId}`
3. Remove specific items: `DELETE /cart/user/{userId}/item/{itemId}`
4. Clear entire cart: `DELETE /cart/user/{userId}`

---

## ⚠️ IMPORTANT IMPLEMENTATION NOTES

### **Order Creation Implementation Discrepancy**

There are currently **two different approaches** for order creation in the codebase:

#### **Current Production Implementation (Cart-Based)**
- **Location**: `apps/order/src/order.service.ts` (lines 74-103)
- **Behavior**: Only accepts `addressId`, fetches items from user's active cart
- **DTO**: `OrderRequestDto` with only `addressId` field
- **Workflow**: Cart → Order conversion

#### **Test Implementation (Direct Items)**
- **Location**: `apps/order/test/app.e2e-spec.ts` (lines 74-95)
- **Behavior**: Accepts `addressId` + `orderItems` array directly
- **Expected DTO**: `OrderRequestDto` with `addressId` and `orderItems` fields
- **Workflow**: Direct order creation with items

### **Recommendations**

1. **For Current Production Use**: Use the **cart-based approach** (Method 9)
   - Add items to cart first
   - Create order with only `addressId`
   - System automatically converts cart to order

2. **For Future Enhancement**: Consider implementing the **direct items approach** (Method 9b)
   - Update `OrderRequestDto` to include optional `orderItems` field
   - Modify service to handle both cart-based and direct item creation
   - Maintain backward compatibility

3. **For Testing**: Use the direct items approach as shown in test files

### **Current Status**
- ✅ **Cart-based creation**: Fully implemented and working
- ⚠️ **Direct items creation**: Defined in tests but DTO needs updating
- 🔄 **Recommended**: Standardize on one approach or support both

---

## 📝 NOTES

- **Gateway Middleware**: Automatically adds user data from JWT to request headers for downstream services
- **Rate Limiting**: Applied globally through API Gateway
- **CORS**: Enabled on API Gateway
- **Logging**: All requests include correlation IDs for tracing
- **Database**: PostgreSQL with automatic migrations and seeding
- **Message Queue**: Kafka integration for event-driven architecture
- **Caching**: Redis integration for session management
```
```
