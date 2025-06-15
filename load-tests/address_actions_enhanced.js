// load-tests/address_actions_enhanced.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getAuthenticatedParams, logError } from './common.js';

export const createAddressTime = new Trend('action_create_address_time');
export const getAddressesTime = new Trend('action_get_addresses_time');
export const updateAddressTime = new Trend('action_update_address_time');
export const deleteAddressTime = new Trend('action_delete_address_time');

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

export function createAddress(authToken, addressData) {
  const endpoint = '/auth/addresses';
  const payload = JSON.stringify(addressData);
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'create_address',
      payload_size: payload.length,
      address_type: addressData.addressType || 'SHIPPING'
    }
  };
  
  const res = http.post(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'POST');
  createAddressTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('POST', endpoint, payload, res);

  const success = check(res, {
    'Create address successful': (r) => r.status === 201 || r.status === 200,
    'Address has ID': (r) => {
      try {
        const address = r.json();
        return address && address.id !== null && address.id !== undefined;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'createAddress', `Address type: ${addressData.addressType}`);
    return null;
  }
  
  try {
    const address = res.json();
    if (__ENV.DEBUG === 'true') {
      console.log(`[ADDRESS CREATED] ID: ${address.id}, Type: ${address.addressType}`);
    }
    return address;
  } catch (e) {
    return null;
  }
}

export function getUserAddresses(authToken) {
  const endpoint = '/auth/addresses';
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'get_addresses'
    }
  };
  
  const res = http.get(`${BASE_URL}${endpoint}`, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'GET');
  getAddressesTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('GET', endpoint, null, res);

  const success = check(res, {
    'Get addresses successful': (r) => r.status === 200,
    'Response is array': (r) => {
      try {
        const addresses = r.json();
        return Array.isArray(addresses);
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    logError(res, 'getUserAddresses');
    return [];
  }
  
  try {
    const addresses = res.json();
    if (__ENV.DEBUG === 'true') {
      console.log(`[ADDRESSES RETRIEVED] Count: ${addresses.length}`);
      addresses.forEach((addr, index) => {
        console.log(`  Address ${index + 1}: ID=${addr.id}, Type=${addr.addressType}, Default=${addr.isDefault}`);
      });
    }
    return addresses;
  } catch (e) {
    return [];
  }
}

export function updateAddress(authToken, addressId, addressData) {
  const endpoint = `/auth/addresses/${addressId}`;
  const payload = JSON.stringify(addressData);
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'update_address',
      payload_size: payload.length,
      address_id: addressId.toString()
    }
  };
  
  const res = http.put(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'PUT');
  updateAddressTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('PUT', endpoint, payload, res);

  const success = check(res, {
    'Update address successful': (r) => r.status === 200,
  });
  
  if (!success) {
    logError(res, 'updateAddress', `Address ID: ${addressId}`);
    return null;
  }
  
  try {
    const address = res.json();
    if (__ENV.DEBUG === 'true') {
      console.log(`[ADDRESS UPDATED] ID: ${addressId}`);
    }
    return address;
  } catch (e) {
    return null;
  }
}

export function deleteAddress(authToken, addressId) {
  const endpoint = `/auth/addresses/${addressId}`;
  
  // Add custom tags to the request
  const params = {
    ...getAuthenticatedParams(authToken),
    tags: {
      endpoint: endpoint,
      operation: 'delete_address',
      address_id: addressId.toString()
    }
  };
  
  const res = http.del(`${BASE_URL}${endpoint}`, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'DELETE');
  deleteAddressTime.add(res.timings.duration);
  
  // Log request/response details
  logRequestResponse('DELETE', endpoint, null, res);

  const success = check(res, {
    'Delete address successful': (r) => r.status === 200 || r.status === 204,
  });
  
  if (!success) {
    logError(res, 'deleteAddress', `Address ID: ${addressId}`);
  } else if (__ENV.DEBUG === 'true') {
    console.log(`[ADDRESS DELETED] ID: ${addressId}`);
  }
  
  return success;
}

// Helper function to manage addresses
export function ensureUserHasAddress(authToken) {
  const addresses = getUserAddresses(authToken);
  
  if (addresses && addresses.length > 0) {
    // Find default address or first one
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
    if (__ENV.DEBUG === 'true') {
      console.log(`[ADDRESS MANAGER] Using existing address ID: ${defaultAddress.id}`);
    }
    return defaultAddress;
  }
  
  // Create new address if none exist
  const newAddress = {
    street: `${__VU} Auto Street`,
    city: "TestCity",
    state: "TS",
    zipCode: "12345",
    country: "TC",
    isDefault: true,
    addressType: "SHIPPING"
  };
  
  const created = createAddress(authToken, newAddress);
  if (created && __ENV.DEBUG === 'true') {
    console.log(`[ADDRESS MANAGER] Created new address ID: ${created.id}`);
  }
  
  return created;
}