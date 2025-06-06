import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { CART_URL, getUserPayloadFromToken, isTokenExpired } from '../common.js'; // Import JWT utilities

// --- Configuration ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api'; // API Gateway URL
const VUS = parseInt(__ENV.VUS || '3');
const DURATION = __ENV.DURATION || '15s';
const RAMP_UP_TIME = __ENV.RAMP_UP_TIME || '5s';
const RAMP_DOWN_TIME = __ENV.RAMP_DOWN_TIME || '5s';

// Test user credentials (ideally from environment variables for security)
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'testuser@example.com'; // Ensure this user exists
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'password123';
const DEFAULT_ADDRESS_ID = __ENV.DEFAULT_ADDRESS_ID || '1'; // Ensure this address ID is valid for the test user

// --- k6 Options ---
export const options = {
  stages: [
    { duration: RAMP_UP_TIME, target: VUS },
    { duration: DURATION, target: VUS },
    { duration: RAMP_DOWN_TIME, target: 0 },
  ],
  thresholds: {
    'http_req_failed': ['rate<0.02'], // Allow slightly higher for more complex flow
    'http_req_duration': ['p(95)<1500'], // 95% of requests should be below 1.5s
    'checks': ['rate>0.98'],
    'group_duration{group:::Order API - Login}': ['p(95)<500'],
    'group_duration{group:::Order API - Get Products}': ['p(95)<800'],
    'group_duration{group:::Order API - Add to Cart}': ['p(95)<700'],
    'group_duration{group:::Order API - Create Order}': ['p(95)<1200'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// --- Custom Metrics ---
const loginDuration = new Trend('order_login_duration');
const getProductsDuration = new Trend('order_get_products_duration');
const addToCartDuration = new Trend('order_add_to_cart_duration');
const createOrderDuration = new Trend('order_create_order_duration');
const orderCreationSuccessRate = new Rate('order_creation_successful_rate');
const orderErrorRate = new Rate('order_errors');

// --- Test Data (Example: Load product IDs from a shared array/JSON if needed) ---
// For simplicity, we'll try to pick one product from the fetched list.
// More robust: use a SharedArray to load product data from a file.
// const productsData = new SharedArray('products', function () {
//   return JSON.parse(open('./products.json')); // Requires a products.json file
// });


// --- Test Logic ---
export default function () {
  let authToken = null;
  let userPayload = null;
  let addressId = DEFAULT_ADDRESS_ID;
  group('Order API - Login', function () {
    const loginPayload = JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    const loginParams = { headers: { 'Content-Type': 'application/json' } };
    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

    loginDuration.add(loginRes.timings.duration);
    const loginSuccess = check(loginRes, {
      'Login successful': (r) => r.status === 200 && r.json('accessToken') !== null,
    });
    if (loginSuccess) {
      authToken = loginRes.json('accessToken');

      // Extract user payload from JWT
      userPayload = getUserPayloadFromToken(authToken);
      if (userPayload) {
        check(userPayload, {
          'JWT contains valid user data': (p) => p.id && p.email && p.name,
          'JWT email matches login email': (p) => p.email === TEST_USER_EMAIL,
          'JWT token is not expired': () => !isTokenExpired(authToken),
        });

        if (__ENV.DEBUG === 'true') {
          console.log(`Order Test - Logged in as: ${userPayload.name} (ID: ${userPayload.id}, Email: ${userPayload.email})`);
        }
      } else {
        console.error('Order Test - Failed to decode JWT token');
        orderErrorRate.add(1);
      }
    } else {
      orderErrorRate.add(1);
      console.error(`Order Test - Login failed: ${loginRes.status} - ${loginRes.body}`);
      return; // Stop this iteration if login fails
    }
  });

  if (!authToken) {
    console.error('Order Test - No auth token, cannot proceed.');
    return;
  }

  sleep(1); // Pause after login

  let products = [];
  group('Order API - Get Products', function () {
    const productParams = { headers: { 'Authorization': `Bearer ${authToken}` } };
    const productRes = http.get(`${BASE_URL}/products`, productParams); // Assuming /api/products

    getProductsDuration.add(productRes.timings.duration);
    const getProductsSuccess = check(productRes, {
      'Get products successful': (r) => r.status === 200,
      'Products list is not empty': (r) => r.json() && r.json().length > 0,
    });
    if (getProductsSuccess) {
      products = productRes.json();
    } else {
      orderErrorRate.add(1);
      console.error(`Order Test - Get Products failed: ${productRes.status} - ${productRes.body}`);
      return; // Stop if no products
    }
  });

  if (products.length === 0) {
    console.error('Order Test - No products found to add to cart.');
    return;
  }

  sleep(1);

  // Add a product to cart
  group('Order API - Add Item to to Cart', function () {
    const productToAdd = products[Math.floor(Math.random() * products.length)]; // Pick a random product
    if (!productToAdd || !productToAdd.id) {
      console.error('Order Test - Selected product is invalid.');
      orderErrorRate.add(1);
      return;
    }

    const addToCartPayload = JSON.stringify({
      productId: productToAdd.id,
      quantity: 1,
    });
    const cartParams = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    userPayload = getUserPayloadFromToken(authToken);
    let userId = null;
    if (userPayload) {
      userId = userPayload.id;
    }
      const addToCartRes = http.post(`${CART_URL}/user/${userId}/item`, addToCartPayload, cartParams);

      addToCartDuration.add(addToCartRes.timings.duration);
      const addToCartSuccess = check(addToCartRes, {
        'Add to cart successful': (r) => r.status === 201 || r.status === 200, // 201 for created, 200 for updated
      });
      if (!addToCartSuccess) {
        orderErrorRate.add(1);
        console.error(`Order Test - Add to Cart failed: ${addToCartRes.status} - ${addToCartRes.body} for product ${productToAdd.id}`);
        return;
      }
    });

  sleep(1);

  group('Order API - Create Order', function () {
    const createOrderPayload = JSON.stringify({
      addressId: DEFAULT_ADDRESS_ID, // Ensure this address is valid for the test user
      // Other fields if required by your API, e.g., paymentInfo
    });
    const orderParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };
    const orderRes = http.post(`${BASE_URL}/order/orders`, createOrderPayload, orderParams);

    createOrderDuration.add(orderRes.timings.duration);
    const createOrderSuccess = check(orderRes, {
      'Order creation successful': (r) => r.status === 201,
      'Order response contains aliasId': (r) => r.json('aliasId') !== null && r.json('aliasId') !== undefined,
    });

    if (createOrderSuccess) {
      orderCreationSuccessRate.add(1);
      const orderId = orderRes.json('aliasId');

      // Log order creation with user info from JWT
      if (__ENV.DEBUG === 'true' && userPayload) {
        console.log(`Order ${orderId} created successfully for user: ${userPayload.name} (ID: ${userPayload.id})`);
      }

      // Verify the order belongs to the correct user (if the API returns user info)
      if (orderRes.json('userId')) {
        check(orderRes, {
          'Order created for correct user': (r) => r.json('userId') === userPayload.id,
        });
      }
    } else {
      orderErrorRate.add(1);
      console.error(`Order Test - Create Order failed: ${orderRes.status} - ${orderRes.body}`);
    }
  });

  sleep(1); // Think time
}