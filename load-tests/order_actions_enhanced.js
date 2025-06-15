// load-tests/order_actions_enhanced.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getAuthenticatedParams, logError } from './common.js';

export const createOrderTime = new Trend('action_create_order_time');
export const getOrderTime = new Trend('action_get_order_time');
export const cancelOrderTime = new Trend('action_cancel_order_time');

// Enhanced metrics for detailed tracking
export const httpReqsByEndpoint = new Counter('http_reqs_by_endpoint');
export const httpReqsByStatus = new Counter('http_reqs_by_status');
export const httpReqDurationByEndpoint = new Trend('http_req_duration_by_endpoint');
export const orderCreationSuccess = new Counter('order_creation_success');
export const orderCreationFailure = new Counter('order_creation_failure');

// Helper function to track detailed metrics
function trackDetailedMetrics(response, endpoint, method) {
  // Track by endpoint
  httpReqsByEndpoint.add(1, { endpoint: endpoint, method: method });
  
  // Track by status code
  httpReqsByStatus.add(1, { 
    endpoint: endpoint, 
    status: response.status.toString(),
    method: method 
  });
  
  // Track duration by endpoint
  httpReqDurationByEndpoint.add(response.timings.duration, { 
    endpoint: endpoint,
    method: method,
    status: response.status.toString()
  });
}

// Helper function to log request/response details
function logRequestResponse(method, endpoint, payload, response) {
  if (__ENV.DEBUG === 'true') {
    console.log(`\n[${method}] ${endpoint}`);
    console.log(`[REQUEST] Payload: ${payload || 'No payload'}`);
    console.log(`[RESPONSE] Status: ${response.status}`);
    console.log(`[RESPONSE] Duration: ${response.timings.duration}ms`);
    console.log(`[RESPONSE] Body: ${response.body ? response.body.substring(0, 500) : 'null'}`);
    
    // Log specific error details
    if (response.status >= 400) {
      console.error(`[ERROR] Failed request to ${endpoint}`);
      console.error(`[ERROR] Full response: ${response.body}`);
    }
  }
}

export function createOrder(authToken, addressId, paymentInfo = null) {
  const endpoint = '/order/orders';
  const orderPayload = {
    addressId
  };
  
  // Add payment info if provided
  if (paymentInfo) {
    orderPayload.paymentInfo = paymentInfo;
  }
  
  const payload = JSON.stringify(orderPayload);
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'create_order',
      payload_size: payload.length,
      address_id: addressId.toString()
    }
  };
  
  const res = http.post(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'POST');
  createOrderTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('POST', endpoint, payload, res);

  const success = check(res, {
    'Order creation successful': (r) => r.status === 201,
    'Order has aliasId': (r) => {
      try {
        const jsonResponse = res.json();
        const order = jsonResponse.data;
        return order && order.aliasId !=null;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (success) {
    orderCreationSuccess.add(1);
    const order = res.json();
    
    if (__ENV.DEBUG === 'true') {
      console.log(`[SUCCESS] Order created: ${order.aliasId}`);
      console.log(`[ORDER DETAILS] ${JSON.stringify(order, null, 2)}`);
    }
    
    return order;
  } else {
    orderCreationFailure.add(1);
    logError(res, 'createOrder', `AddressId: ${addressId}`);
    return null;
  }
}

export function getOrder(authToken, aliasId) {
  const endpoint = `/order/${aliasId}`;

  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'get_order',
      order_id: aliasId
    }
  };
  
  const res = http.get(`${BASE_URL}${endpoint}`, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'GET');
  getOrderTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('GET', endpoint, null, res);

  const success = check(res, {
    'Get order successful': (r) => r.status === 200,
    'Order data valid': (r) => {
      try {
        const jsonResponse = res.json();
        const order = jsonResponse.data;
        return order && order.aliasId != null;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'getOrder', `OrderId: ${orderId}`);
    return null;
  }
  
  try {
    const order = res.json();
    if (__ENV.DEBUG === 'true') {
      console.log(`[ORDER STATUS] Order ${orderId}: ${order.status}`);
    }
    return order;
  } catch (e) {
    return null;
  }
}

export function getOrders(authToken, page = 1, limit = 10) {
  const endpoint = `/order/orders`;
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: '/orders',
      operation: 'get_orders',
      page: page.toString(),
      limit: limit.toString()
    }
  };
  
  const res = http.get(`${BASE_URL}${endpoint}`, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, '/orders', 'GET');
  
  // Log request/response details
  logRequestResponse('GET', endpoint, null, res);

  const success = check(res, {
    'Get orders successful': (r) => r.status === 200,
    'Orders list valid': (r) => {
      try {
        const response = r.json();
        return response && Array.isArray(response.orders || response);
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'getOrders', `Page: ${page}, Limit: ${limit}`);
    return [];
  }
  
  try {
    const response = res.json();
    const orders = response.orders || response;
    
    if (__ENV.DEBUG === 'true') {
      console.log(`[ORDERS LIST] Found ${orders.length} orders`);
    }
    
    return orders;
  } catch (e) {
    return [];
  }
}

export function cancelOrder(authToken, orderId) {
  const endpoint = `/orders/${orderId}/cancel`;
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'cancel_order',
      order_id: orderId.toString()
    }
  };
  
  const res = http.post(`${BASE_URL}${endpoint}`, null, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'POST');
  cancelOrderTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('POST', endpoint, null, res);

  const success = check(res, {
    'Order cancellation successful': (r) => r.status === 200 || r.status === 204,
    'Cancellation response valid': (r) => {
      if (r.status === 204) return true; // No content expected
      try {
        const response = r.json();
        return response && (response.status === 'CANCELLED' || response.message);
      } catch (e) {
        return false;
      }
    }
  });
  
  if (success) {
    if (__ENV.DEBUG === 'true') {
      console.log(`[SUCCESS] Order ${orderId} cancelled successfully`);
    }
  } else {
    logError(res, 'cancelOrder', `OrderId: ${orderId}`);
  }
  
  return success;
}

export function updateOrderStatus(authToken, orderId, status) {
  const endpoint = `/orders/${orderId}/status`;
  const payload = JSON.stringify({ status: status });
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'update_order_status',
      order_id: orderId.toString(),
      new_status: status
    }
  };
  
  const res = http.put(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'PUT');
  
  // Log request/response details
  logRequestResponse('PUT', endpoint, payload, res);

  const success = check(res, {
    'Update order status successful': (r) => r.status === 200,
  });
  
  if (!success) {
    logError(res, 'updateOrderStatus', `OrderId: ${orderId}, Status: ${status}`);
  }
  
  return success;
}

// Helper function to track order lifecycle
export function trackOrderLifecycle(authToken, orderId) {
  if (__ENV.DEBUG !== 'true') return;
  
  console.log(`\n[ORDER LIFECYCLE] Tracking order ${orderId}`);
  
  const order = getOrder(authToken, orderId);
  if (order) {
    console.log(`[ORDER LIFECYCLE] Current status: ${order.status}`);
    console.log(`[ORDER LIFECYCLE] Total amount: ${order.totalAmount}`);
    console.log(`[ORDER LIFECYCLE] Items count: ${order.items ? order.items.length : 0}`);
    
    if (order.items) {
      order.items.forEach((item, index) => {
        console.log(`[ORDER LIFECYCLE] Item ${index + 1}: Product ${item.productId}, Qty: ${item.quantity}, Price: ${item.price}`);
      });
    }
  }
}