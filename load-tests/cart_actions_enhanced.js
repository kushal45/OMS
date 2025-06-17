// load-tests/cart_actions_enhanced.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_CART_URL, getAuthenticatedParams, getUserPayloadFromToken, logError } from './common.js';

export const addToCartTime = new Trend('action_add_to_cart_time');
export const getCartTime = new Trend('action_get_cart_time');

// Enhanced metrics for detailed tracking
export const httpReqsByEndpoint = new Counter('http_reqs_by_endpoint');
export const httpReqsByStatus = new Counter('http_reqs_by_status');
export const httpReqDurationByEndpoint = new Trend('http_req_duration_by_endpoint');

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

export function addToCart(authToken, productId, quantity) {
  const payload = JSON.stringify({ 
    productId, 
    quantity 
  });
  let userId= 1;
  const userPayload = getUserPayloadFromToken(authToken);
  console.log("userPayload fetched ::::::", userPayload);
  if(userPayload) {
    userId = userPayload.id;
  }

  const endpoint = `/cart/user/${userId}/item`
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'add_to_cart',
      payload_size: payload.length,
      product_id: productId
    }
  };
  const absoluteEndpoint = `${BASE_CART_URL}${endpoint}`;
  const res = http.post(absoluteEndpoint, payload, params);

  // Track detailed metrics
  trackDetailedMetrics(res, absoluteEndpoint, 'POST');
  addToCartTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('POST', absoluteEndpoint, payload, res);

  const success = check(res, {
    'Add to cart successful': (r) => r.status === 201 || r.status === 200,
    'Response has cart data': (r) => {
      try {
        return r.json() !== null;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'addToCart', `ProductId: ${productId}, Quantity: ${quantity}`);
  }
  
  return success;
}

export function getCart(authToken) {
  
  // Add custom tags to the request
 
  
  let userId= 1;
  const userPayload = getUserPayloadFromToken(authToken);
  if(userPayload) {
    userId = userPayload.id;
  }
  const endpoint = `/cart/user/${userId}`;
 const params = {
    tags: {
      endpoint: endpoint || '/cart',
      operation: 'get_cart'
    }
  };
   const res = http.get(`${BASE_CART_URL}${endpoint}`, params);
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint || '/cart', 'GET');
  getCartTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('GET', endpoint, null, res);

  const success = check(res, {
    'Get cart successful': (r) => r.status === 200,
    'Cart response valid': (r) => {
      try {
        const jsonResponse = res.json();
        const cart = jsonResponse.data;
        return cart && (cart.items !== undefined || cart.cartItems !== undefined);
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'getCart');
  }
  
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export function updateCartItem(authToken, itemId, quantity) {
  let userId= 1;
  const userPayload = getUserPayloadFromToken(authToken);
  if(userPayload) {
    userId = userPayload.id;
  }
  const endpoint = `/cart/user/${userId}/item/${itemId}`;
  const payload = JSON.stringify({ quantity: quantity });
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'update_cart_item',
      payload_size: payload.length,
      item_id: itemId
    }
  };
  
  const res = http.put(`${BASE_CART_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'PUT');
  
  // Log request/response details
  logRequestResponse('PUT', endpoint, payload, res);

  const success = check(res, {
    'Update cart item successful': (r) => r.status === 200,
  });
  
  if (!success) {
    logError(res, 'updateCartItem', `ItemId: ${itemId}, Quantity: ${quantity}`);
  }
  
  return success;
}

export function removeFromCart(authToken, itemId) {
  const userPayload = getUserPayloadFromToken(authToken);
  let userId = 1;
  if (userPayload) {
    userId = userPayload.id;
  }
  const endpoint = `/cart/user/${userId}/item/${itemId}`;

  // Add custom tags to the request
  const params = {
    tags: {
      endpoint: endpoint,
      operation: 'remove_from_cart',
      item_id: itemId
    }
  };
  
  const res = http.del(`${BASE_CART_URL}${endpoint}`, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'DELETE');
  
  // Log request/response details
  logRequestResponse('DELETE', endpoint, null, res);

  const success = check(res, {
    'Remove from cart successful': (r) => r.status === 200 || r.status === 204,
  });
  
  if (!success) {
    logError(res, 'removeFromCart', `ItemId: ${itemId}`);
  }
  
  return success;
}

export function clearCart(authToken) {
  const userPayload = getUserPayloadFromToken(authToken);
  let userId = 1;
  if (userPayload) {
    userId = userPayload.id;
  }
  const endpoint = `/cart/user/${userId}`;

  // Add custom tags to the request
  const params = {
    tags: {
      endpoint: endpoint,
      operation: 'clear_cart'
    }
  };
  
  const res = http.del(`${BASE_CART_URL}${endpoint}`, null, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'DELETE');

  // Log request/response details
  logRequestResponse('DELETE', endpoint, null, res);

  const success = check(res, {
    'Clear cart successful': (r) => r.status === 200 || r.status === 204,
  });
  
  if (!success) {
    logError(res, 'clearCart');
  }
  
  return success;
}