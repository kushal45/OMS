// load-tests/auth_actions_enhanced.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, defaultParams, logError } from './common.js';

export const registerTime = new Trend('action_register_time');
export const loginTime = new Trend('action_login_time');

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

export function registerUser(email, name, password) {
  const endpoint = '/auth/register';
  const payload = JSON.stringify({ name, email, password });
  
  // Add custom tags to the request
  const params = {
    ...defaultParams,
    tags: {
      endpoint: endpoint,
      operation: 'register',
      payload_size: payload.length
    }
  };
  
  const res = http.post(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'POST');
  registerTime.add(res.timings.duration);

  const success = check(res.data, {
    'Registration successful (status 201)': (r) => r.status === 201,
    'Registration response has data.id': (r) => r.json('data.id') !== null && r.json('data.id') !== undefined,
  });
  
  if (!success) {
    logError(res, 'registerUser', `Email: ${email}`);
  }
  
  // Log request/response details in debug mode
  if (__ENV.DEBUG === 'true') {
    console.log(`[REGISTER] Request: ${endpoint}`);
    console.log(`[REGISTER] Payload: ${payload}`);
    console.log(`[REGISTER] Status: ${res.status}`);
    console.log(`[REGISTER] Response: ${res.body ? res.body.substring(0, 200) : 'null'}`);
  }
  
  return success ? res.json('data.id') : null;
}

export function loginUser(email, password) {
  const endpoint = '/auth/login';
  const payload = JSON.stringify({ email, password });
  
  // Add custom tags to the request
  const params = {
    ...defaultParams,
    tags: {
      endpoint: endpoint,
      operation: 'login',
      payload_size: payload.length
    }
  };
  
  const res = http.post(`${BASE_URL}${endpoint}`, payload, params);
  
  // Track detailed metrics
  trackDetailedMetrics(res, endpoint, 'POST');
  loginTime.add(res.timings.duration);

  let authToken = null;
  const success = check(res, {
    'Login successful (status 200)': (r) => r.status === 200,
    'Login response has accessToken': (r) => {
      // Handle null body gracefully
      if (!r.body) {
        console.error(`Login failed - no response body. Status: ${r.status}, URL: ${BASE_URL}${endpoint}`);
        return false;
      }
      try {
        // Handle both response formats:
        // 1. Direct: { "accessToken": "..." }
        // 2. Nested: { "data": { "accessToken": "..." } }
        const responseData = r.json();
        
        // Try nested format first (data.accessToken)
        if (responseData.data && responseData.data.accessToken) {
          authToken = responseData.data.accessToken;
          return true;
        }
        
        // Try direct format (accessToken)
        if (responseData.accessToken) {
          authToken = responseData.accessToken;
          return true;
        }
        
        // Neither format found
        console.error(`Login response missing accessToken. Response: ${JSON.stringify(responseData)}`);
        return false;
      } catch (e) {
        console.error(`Login failed - invalid JSON response: ${e.message}`);
        return false;
      }
    },
  });

  if (!success) {
    logError(res, 'loginUser', `Email: ${email}`);
  }
  
  // Log request/response details in debug mode
  if (__ENV.DEBUG === 'true') {
    console.log(`[LOGIN] Request: ${endpoint}`);
    console.log(`[LOGIN] Payload: ${payload}`);
    console.log(`[LOGIN] Status: ${res.status}`);
    console.log(`[LOGIN] Response: ${res.body ? res.body.substring(0, 200) : 'null'}`);
  }
  
  return authToken;
}