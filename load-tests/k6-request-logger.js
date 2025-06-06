import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom request/response logger
export class RequestLogger {
  constructor() {
    this.requests = [];
  }

  logRequest(method, url, payload, headers) {
    const timestamp = new Date().toISOString();
    const requestId = `${timestamp}-${Math.random().toString(36).substring(7)}`;
    
    const requestData = {
      id: requestId,
      timestamp: timestamp,
      method: method,
      url: url,
      payload: payload,
      headers: headers,
      response: null
    };
    
    this.requests.push(requestData);
    return requestId;
  }

  logResponse(requestId, response) {
    const request = this.requests.find(r => r.id === requestId);
    if (request) {
      request.response = {
        status: response.status,
        statusText: response.status_text || '',
        headers: response.headers || {},
        body: response.body ? response.body.substring(0, 1000) : null, // Limit body size
        duration: response.timings ? response.timings.duration : null,
        timings: response.timings || {}
      };
    }
  }

  getRequests() {
    return this.requests;
  }

  getSummary() {
    const summary = {
      totalRequests: this.requests.length,
      byStatus: {},
      byEndpoint: {},
      errors: []
    };

    this.requests.forEach(req => {
      if (req.response) {
        // Count by status
        const status = req.response.status.toString();
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;

        // Count by endpoint
        const endpoint = req.url.replace(/https?:\/\/[^\/]+/, '');
        summary.byEndpoint[endpoint] = (summary.byEndpoint[endpoint] || 0) + 1;

        // Collect errors
        if (req.response.status >= 400) {
          summary.errors.push({
            timestamp: req.timestamp,
            method: req.method,
            url: req.url,
            status: req.response.status,
            body: req.response.body
          });
        }
      }
    });

    return summary;
  }
}

// Global request logger instance
export const requestLogger = new RequestLogger();

// Enhanced HTTP wrapper
export function httpWithLogging(method, url, payload, params) {
  const http = require('k6/http');
  
  // Log request
  const requestId = requestLogger.logRequest(method, url, payload, params.headers || {});
  
  // Make the actual request
  let response;
  switch (method.toUpperCase()) {
    case 'GET':
      response = http.get(url, params);
      break;
    case 'POST':
      response = http.post(url, payload, params);
      break;
    case 'PUT':
      response = http.put(url, payload, params);
      break;
    case 'DELETE':
      response = http.del(url, params);
      break;
    default:
      response = http.request(method, url, payload, params);
  }
  
  // Log response
  requestLogger.logResponse(requestId, response);
  
  return response;
}

// Custom summary handler that includes request details
export function handleSummary(data) {
  const requestSummary = requestLogger.getSummary();
  
  // Add request details to the summary
  data.customData = {
    requests: requestSummary,
    detailedErrors: requestSummary.errors.slice(0, 10) // First 10 errors
  };

  // Generate both console and JSON outputs
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'request-details.json': JSON.stringify(requestLogger.getRequests(), null, 2)
  };
}

// Helper function to extract and format request/response for debugging
export function formatRequestResponse(request) {
  if (!request.response) {
    return `Request without response: ${request.method} ${request.url}`;
  }

  return `
=== REQUEST ===
Timestamp: ${request.timestamp}
Method: ${request.method}
URL: ${request.url}
Payload: ${JSON.stringify(request.payload, null, 2)}

=== RESPONSE ===
Status: ${request.response.status} ${request.response.statusText}
Duration: ${request.response.duration}ms
Body: ${request.response.body}
`;
}