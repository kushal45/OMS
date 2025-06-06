// load-tests/product_actions.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_PRODUCT_URL, getAuthenticatedParams, logError } from './common.js';

export const getProductsTime = new Trend('action_get_products_time');

export function getProducts(authToken) {
  if (!authToken) {
    console.error('getProducts: authToken is missing.');
    return null;
  }
  const params = getAuthenticatedParams(authToken);
  const res = http.get(`${BASE_PRODUCT_URL}/products`, params);
  getProductsTime.add(res.timings.duration);

  let products = null;
  const jsonResponse = res.json();

  // Perform checks
  const success = check(res, {
    'Get products successful (status 200)': (r) => r.status === 200,
    'Response has "status": "success"': (r) => jsonResponse && jsonResponse.status === 'success',
    'Response has "data" array': (r) => jsonResponse && Array.isArray(jsonResponse.data),
  });

  if (success) {
    products = jsonResponse.data;
    if (products.length === 0) {
        // This might not be an "error" per se, but good to note for test logic
        console.log('getProducts: Received empty product list.');
    }
  } else {
    logError(res, 'getProducts');
  }
  return products; // Returns array of products or null on error/empty
}