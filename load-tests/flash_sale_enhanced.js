import { sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Counter, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Import actions from enhanced modular files
import { BASE_URL, GENERAL_ERROR_RATE, logError, getUserPayloadFromToken } from './common.js';
import { registerUser as actionRegisterUser, loginUser as actionLoginUser } from './auth_actions_enhanced.js';
import { getProducts as actionGetProducts } from './product_actions.js';
import { 
  addToCart as actionAddToCart, 
  getCart as actionGetCart, 
  clearCart as actionClearCart,
  updateCartItem as actionUpdateCartItem,
  removeFromCart as actionRemoveFromCart 
} from './cart_actions_enhanced.js';
import { 
  getUserAddresses as actionGetUserAddresses, 
  createAddress as actionCreateAddress,
  updateAddress as actionUpdateAddress,
  deleteAddress as actionDeleteAddress,
  ensureUserHasAddress
} from './address_actions_enhanced.js';
import { 
  createOrder as actionCreateOrder, 
  cancelOrder as actionCancelOrder, 
  getOrder as actionGetOrder, 
  getOrders as actionGetOrders,
  trackOrderLifecycle 
} from './order_actions_enhanced.js';

// Global request logger
const requestLog = [];

// Helper to log requests
function logRequest(type, data) {
  requestLog.push({
    timestamp: new Date().toISOString(),
    vu: __VU,
    iteration: __ITER,
    scenario: __ENV.SCENARIO_NAME || 'unknown',
    type: type,
    ...data
  });
}

// --- Configuration ---
const PEAK_VUS_ADD_CART = parseInt(__ENV.PEAK_VUS_ADD_CART || '80');
const PEAK_VUS_PLACE_ORDER = parseInt(__ENV.PEAK_VUS_PLACE_ORDER || '60');
const PEAK_VUS_CANCEL_ORDER = parseInt(__ENV.PEAK_VUS_CANCEL_ORDER || '15');
const PEAK_VUS_REGISTER = parseInt(__ENV.PEAK_VUS_REGISTER || '20');
const FLASH_SALE_DURATION = __ENV.FLASH_SALE_DURATION || '1m';
const RAMP_UP_TIME = __ENV.RAMP_UP_TIME || '10s';
const RAMP_DOWN_TIME = __ENV.RAMP_DOWN_TIME || '10s';
const SKIP_REGISTRATION = __ENV.SKIP_REGISTRATION === 'true'  || true; // Default to true if not set

// Dynamic user configuration
const USE_DYNAMIC_USERS = __ENV.USE_DYNAMIC_USERS !== 'false'; // Default to true
const USER_PREFIX = __ENV.USER_PREFIX || 'flash_user';
const USER_DOMAIN = __ENV.USER_DOMAIN || 'example.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || 'password123';
const REUSE_USERS_PROBABILITY = parseFloat(__ENV.REUSE_USERS_PROBABILITY || '0.7'); // 70% chance to reuse existing user

// Store dynamically created users in memory for reuse
const dynamicUsers = new Map();

// Custom metrics for detailed tracking
export const httpReqsByEndpoint = new Counter('http_reqs_by_endpoint');
export const httpReqsByStatus = new Counter('http_reqs_by_status');
export const httpReqDurationByEndpoint = new Trend('http_req_duration_by_endpoint');
export const flowCompletionRate = new Counter('flow_completion_rate');
export const scenarioExecutions = new Counter('scenario_executions');

// --- Test Data ---
// Load from users.json if available and USE_DYNAMIC_USERS is false
const users = new SharedArray('users', function () {
  if (!USE_DYNAMIC_USERS) {
    try {
      return JSON.parse(open('./users.json'));
    } catch (e) {
      console.warn("USE_DYNAMIC_USERS is false but failed to load users.json. Will use dynamic users.");
      return [];
    }
  }
  return [];
});

const selectedScenarios = {};
if(!SKIP_REGISTRATION){
selectedScenarios.registration_scenario={
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: RAMP_UP_TIME, target: PEAK_VUS_REGISTER },
    { duration: FLASH_SALE_DURATION, target: PEAK_VUS_REGISTER },
    { duration: RAMP_DOWN_TIME, target: 0 },
  ],
  exec: 'registerNewUserFlow',
  env: { SCENARIO_NAME: 'register_new_user' },
}
}

// --- k6 Options ---
export const options = {
  scenarios: {
    ...selectedScenarios,
    add_to_cart_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_TIME, target: PEAK_VUS_ADD_CART },
        { duration: FLASH_SALE_DURATION, target: PEAK_VUS_ADD_CART },
        { duration: RAMP_DOWN_TIME, target: 0 },
      ],
      exec: 'addToCartFlow',
      env: { SCENARIO_NAME: 'add_to_cart' },
      startTime: '1s', // Reduced delay
    },
    place_order_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_TIME, target: PEAK_VUS_PLACE_ORDER },
        { duration: FLASH_SALE_DURATION, target: PEAK_VUS_PLACE_ORDER },
        { duration: RAMP_DOWN_TIME, target: 0 },
      ],
      exec: 'placeOrderFlow',
      env: { SCENARIO_NAME: 'place_order' },
      startTime: '2s', // Reduced delay
    },
    cancel_order_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_TIME, target: PEAK_VUS_CANCEL_ORDER },
        { duration: FLASH_SALE_DURATION, target: PEAK_VUS_CANCEL_ORDER },
        { duration: RAMP_DOWN_TIME, target: 0 },
      ],
      exec: 'cancelOrderFlow',
      env: { SCENARIO_NAME: 'cancel_order' },
      startTime: '3s', // Reduced delay
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.75'],
    'http_req_duration': ['p(95)<2000'],
    'checks': ['rate>0.95'],
    'group_duration{group:::FlashSale Login}': ['p(95)<800'],
    'group_duration{group:::FlashSale Get Products}': ['p(95)<1000'],
    'group_duration{group:::FlashSale Add To Cart}': ['p(95)<800'],
    'group_duration{group:::FlashSale Create Order}': ['p(95)<1500'],
    'group_duration{group:::FlashSale Cancel Order}': ['p(95)<1000'],
    'group_duration{group:::FlashSale Register New User}': ['p(95)<1200'],
  },
};

// Helper function to get or create a dynamic user
function getDynamicUser() {
  // Decide whether to reuse an existing user or create a new one
  const shouldReuseUser = Math.random() < REUSE_USERS_PROBABILITY && dynamicUsers.size > 0;
  
  if (shouldReuseUser) {
    // Pick a random existing user
    const userArray = Array.from(dynamicUsers.values());
    const randomUser = userArray[Math.floor(Math.random() * userArray.length)];
    return randomUser;
  } else {
    // Create a new user
    const uniqueId = uuidv4().substring(0, 12);
    const email = `${USER_PREFIX}_${uniqueId}@${USER_DOMAIN}`;
    const name = `${USER_PREFIX.replace(/_/g, ' ')} ${uniqueId.substring(0, 8)}`;
    const password = USER_PASSWORD;
    
    const newUser = { email, name, password, authToken: null };
    dynamicUsers.set(email, newUser);
    return newUser;
  }
}

// Helper function to get a user (either dynamic or from users.json)
function getUser() {
  if (USE_DYNAMIC_USERS || users.length === 0) {
    return getDynamicUser();
  } else {
    return users[Math.floor(Math.random() * users.length)];
  }
}

// Helper function to ensure user is registered and logged in
function ensureUserAuthenticated(user) {
  let authToken = user.authToken;
  
  // If user doesn't have an auth token, try to login
  if (!authToken) {
    console.log(`[AUTH] Attempting login for ${user.email}`);
    authToken = actionLoginUser(user.email, user.password);
    console.log(`[AUTH] Login attempt for ${user.email} returned token: ${authToken ? 'success' : 'failure'}`);
    // If login fails, register the user first (only for dynamic users)
    if (!authToken && USE_DYNAMIC_USERS) {
      console.log(`[AUTH] Login failed, registering new user ${user.email}`);
      const registrationSuccess = actionRegisterUser(user.email, user.name || user.email, user.password);
      if (registrationSuccess) {
        logRequest('user_registered', { email: user.email, name: user.name });
        sleep(0.5); // Small delay after registration
        authToken = actionLoginUser(user.email, user.password);
      }
    } else if (!authToken && !USE_DYNAMIC_USERS) {
      // For static users, log more details about the failure
      console.error(`[AUTH] Failed to login static user ${user.email}. Ensure user exists in the system.`);
      console.error(`[AUTH] You may need to run: ./load-tests/setup-test-users.sh`);
    }
    
    // Cache the auth token for reuse
    if (authToken) {
      // Only cache for dynamic users or if user object supports it
      if (user.authToken !== undefined) {
        user.authToken = authToken;
      }
      logRequest('user_authenticated', { email: user.email });
      console.log(`[AUTH] Successfully authenticated ${user.email}`);
    } else {
      console.error(`[AUTH] Failed to authenticate ${user.email}`);
    }
  }
  
  return authToken;
}

// --- Scenario: Register New User Flow ---
export function registerNewUserFlow() {
  scenarioExecutions.add(1, { scenario: 'register' });
  console.log(`[SCENARIO] Starting registration flow - VU ${__VU}, Iter ${__ITER}`);
  
  const uniqueId = uuidv4().substring(0, 12);
  const userEmail = `${USER_PREFIX}_new_${uniqueId}@${USER_DOMAIN}`;
  const userName = `${USER_PREFIX.replace(/_/g, ' ')} New ${uniqueId.substring(0, 8)}`;
  const userPassword = USER_PASSWORD;
  if( USE_DYNAMIC_USERS) {
  group('FlashSale Register New User', function () {
    const userId = actionRegisterUser(userEmail, userName, userPassword);
    if (userId) {
      // Store the newly registered user for potential reuse
      dynamicUsers.set(userEmail, { email: userEmail, name: userName, password: userPassword, authToken: null });
      
      logRequest('registration_complete', {
        email: userEmail,
        name: userName,
        userId: userId,
        success: true
      });
      
      flowCompletionRate.add(1, { flow: 'registration', status: 'success' });
      
      console.log(`[REGISTRATION SUCCESS] New user registered: ${userEmail} (ID: ${userId})`);
    } else {
      flowCompletionRate.add(1, { flow: 'registration', status: 'failure' });
      console.error(`[REGISTRATION FAILED] Could not register ${userEmail}`);
    }
  });
}
  
  //sleep(Math.random() * 2 + 1);
}

// --- Scenario: Add to Cart Flow ---
export function addToCartFlow() {
  scenarioExecutions.add(1, { scenario: 'add_to_cart' });
  console.log(`[SCENARIO] Starting add to cart flow - VU ${__VU}, Iter ${__ITER}`);
  
  const user = getUser();

  group('FlashSale Login', function () {
    const authToken = ensureUserAuthenticated(user);
    
    if (authToken) {
      // Extract user info from JWT for logging
      const userPayload = getUserPayloadFromToken(authToken);
      
      console.log(`[ADD TO CART FLOW] User: ${userPayload?.name || user.email}`);

      group('FlashSale Get Products', function () {
        const products = actionGetProducts(authToken);
        console.log(`[PRODUCTS] Retrieved ${products ? products.length : 0} products`);
        
        if (products && products.length > 0) {
          // Randomly select 1-3 products to add
          const numProducts = Math.floor(Math.random() * 3) + 1;
          const selectedProducts = [];
          
          for (let i = 0; i < numProducts && i < products.length; i++) {
            const productIndex = Math.floor(Math.random() * products.length);
            const product = products[productIndex];
            if (product && product.id && !selectedProducts.find(p => p.id === product.id)) {
              selectedProducts.push(product);
            }
          }
          
          console.log(`[CART] Adding ${selectedProducts.length} products to cart`);
          
          group('FlashSale Add To Cart', function () {
            let cartOperationsSuccess = true;
            
            // Add multiple products
            selectedProducts.forEach((product, index) => {
              const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
              console.log(`[CART] Adding product ${product.id} with quantity ${quantity}`);
              const success = actionAddToCart(authToken, product.id, quantity);
              
              if (success) {
                logRequest('cart_item_added', {
                  productId: product.id,
                  quantity: quantity,
                  userEmail: user.email
                });
              } else {
                cartOperationsSuccess = false;
                console.error(`[CART] Failed to add product ${product.id}`);
              }
              
              if (index < selectedProducts.length - 1) {
                sleep(0.2); // Small delay between adding items
              }
            });
            
            // Get cart contents to verify
            const cart = actionGetCart(authToken);
            if (cart) {
              console.log(`[CART] Current cart: ${cart.items?.length || 0} items, total: ${cart.totalAmount || 0}`);
              logRequest('cart_retrieved', {
                itemCount: cart.items ? cart.items.length : 0,
                totalAmount: cart.totalAmount || 0,
                userEmail: user.email
              });
              
              // Randomly update or remove an item (30% chance)
              if (cart.items && cart.items.length > 0 && Math.random() < 0.3) {
                const randomItem = cart.items[Math.floor(Math.random() * cart.items.length)];
                
                if (Math.random() < 0.5) {
                  // Update quantity
                  const newQuantity = Math.floor(Math.random() * 5) + 1;
                  console.log(`[CART] Updating item ${randomItem.id} quantity to ${newQuantity}`);
                  const updateSuccess = actionUpdateCartItem(authToken, randomItem.id, newQuantity);
                  logRequest('cart_item_updated', {
                    itemId: randomItem.id,
                    newQuantity: newQuantity,
                    success: updateSuccess
                  });
                } else {
                  // Remove item
                  console.log(`[CART] Removing item ${randomItem.id}`);
                  const removeSuccess = actionRemoveFromCart(authToken, randomItem.id);
                  logRequest('cart_item_removed', {
                    itemId: randomItem.id,
                    success: removeSuccess
                  });
                }
              }
            }
            
            flowCompletionRate.add(1, { 
              flow: 'add_to_cart', 
              status: cartOperationsSuccess ? 'success' : 'failure' 
            });
          });
        } else {
          console.log(`[CART] No products available for user ${user.email}`);
          flowCompletionRate.add(1, { flow: 'add_to_cart', status: 'no_products' });
        }
      });
    } else {
      console.error(`[CART] Authentication failed for user ${user.email}`);
      flowCompletionRate.add(1, { flow: 'add_to_cart', status: 'auth_failure' });
    }
  });
  
  sleep(Math.random() * 3 + 1);
}

// --- Scenario: Place Order Flow ---
export function placeOrderFlow() {
  scenarioExecutions.add(1, { scenario: 'place_order' });
  console.log(`[SCENARIO] Starting place order flow - VU ${__VU}, Iter ${__ITER}`);
  
  const user = getUser();
  let orderDetails = null;

  group('FlashSale Login', function () {
    const authToken = ensureUserAuthenticated(user);
    
    if (authToken) {
      const userPayload = getUserPayloadFromToken(authToken);
      
      console.log(`[PLACE ORDER FLOW] User: ${userPayload?.name || user.email}`);
      
      group('FlashSale Get Products', function () {
        const products = actionGetProducts(authToken);
        console.log(`[ORDER] Retrieved ${products ? products.length : 0} products`);
        
        if (products && products.length > 0) {
          // Select 1-2 products for order
          const numProducts = Math.floor(Math.random() * 2) + 1;
          const selectedProducts = [];
          
          for (let i = 0; i < numProducts && i < products.length; i++) {
            const product = products[Math.floor(Math.random() * products.length)];
            if (product && product.id) {
              selectedProducts.push(product);
            }
          }
          
          // Clear cart first to ensure clean state
          console.log(`[ORDER] Clearing cart before adding items`);
          actionClearCart(authToken);
          
          let cartSuccess = true;
          group('FlashSale Add To Cart (Order Pre-step)', function () {
            selectedProducts.forEach(product => {
              const quantity = Math.floor(Math.random() * 2) + 1;
              console.log(`[ORDER] Adding product ${product.id} with quantity ${quantity}`);
              const success = actionAddToCart(authToken, product.id, quantity);
              if (!success) {
                cartSuccess = false;
                console.error(`[ORDER] Failed to add product ${product.id} to cart`);
              }
              sleep(0.1);
            });
          });
          
          if (!cartSuccess) {
            console.error(`[ORDER] Cart preparation failed for user ${user.email}`);
            flowCompletionRate.add(1, { flow: 'place_order', status: 'cart_failure' });
            return;
          }
          sleep(0.5);

          // Address management
          console.log(`[ORDER] Checking addresses for user ${user.email}`);
          let addressIdToUse = null;
          let addresses = actionGetUserAddresses(authToken);
          
          logRequest('addresses_retrieved', {
            count: addresses ? addresses.length : 0,
            userEmail: user.email
          });

          if (addresses && addresses.length > 0 && addresses[0].id) {
            addressIdToUse = addresses[0].id;
            console.log(`[ORDER] Using existing address ID: ${addressIdToUse}`);
            
            // Randomly update address (20% chance)
            if (Math.random() < 0.2) {
              const updatedAddress = {
                street: `${__VU} Updated Street`,
                city: "UpdatedCity",
                state: "US",
                zipCode: "50002",
                country: "UC"
              };
              console.log(`[ORDER] Updating address ${addressIdToUse}`);
              const updateResult = actionUpdateAddress(authToken, addressIdToUse, updatedAddress);
              logRequest('address_updated', {
                addressId: addressIdToUse,
                success: updateResult !== null
              });
            }
          } else {
            console.log(`[ORDER] No existing addresses found. Creating new address.`);
            const newAddressPayload = {
              street: `${__VU} Flash Street`,
              city: "K6City",
              state: "TS",
              country: "TC",
              pincode: "50001"
            };
            
            group('FlashSale Create Address (Order Pre-step)', function () {
              const createdAddress = actionCreateAddress(authToken, newAddressPayload);
              if (createdAddress && createdAddress.id) {
                addressIdToUse = createdAddress.id;
                logRequest('address_created', {
                  addressId: addressIdToUse,
                  userEmail: user.email
                });
                console.log(`[ORDER] Created new address ID: ${addressIdToUse}`);
              } else {
                console.error(`[ORDER] Failed to create address`);
                logError({ status: 'N/A', body: 'Failed to create new address or get ID' }, 'PlaceOrderFlow - CreateAddress');
              }
            });
          }

          if (addressIdToUse) {
            group('FlashSale Create Order', function () {
              console.log(`[ORDER] Creating order with address ID: ${addressIdToUse}`);
              orderDetails = actionCreateOrder(authToken, addressIdToUse);
              if (orderDetails) {
                logRequest('order_created', {
                  orderId: orderDetails.aliasId,
                  status: orderDetails.status,
                  totalAmount: orderDetails.totalAmount,
                  userEmail: user.email
                });
                
                flowCompletionRate.add(1, { flow: 'place_order', status: 'success' });
                
                console.log(`[ORDER SUCCESS] Order created: ${orderDetails.aliasId}, Status: ${orderDetails.status}, Amount: ${orderDetails.totalAmount}`);
                
                // Track order lifecycle
                if (__ENV.DEBUG === 'true') {
                  trackOrderLifecycle(authToken, orderDetails.aliasId);
                }
                
                // Get order history (10% chance)
                if (Math.random() < 0.1) {
                  console.log(`[ORDER] Retrieving order history`);
                  const orders = actionGetOrders(authToken, 1, 5);
                  logRequest('order_history_retrieved', {
                    orderCount: orders.length,
                    userEmail: user.email
                  });
                }
              } else {
                console.error(`[ORDER] Failed to create order`);
                flowCompletionRate.add(1, { flow: 'place_order', status: 'order_failure' });
              }
            });
          } else {
            console.error(`[ORDER] No address available, cannot create order`);
            flowCompletionRate.add(1, { flow: 'place_order', status: 'no_address' });
          }
        } else {
          console.log(`[ORDER] No products available`);
          flowCompletionRate.add(1, { flow: 'place_order', status: 'no_products' });
        }
      });
    } else {
      console.error(`[ORDER] Authentication failed for user ${user.email}`);
      flowCompletionRate.add(1, { flow: 'place_order', status: 'auth_failure' });
    }
  });
  
  sleep(Math.random() * 2 + 0.5);
  return orderDetails;
}

// --- Scenario: Cancel Order Flow ---
export function cancelOrderFlow() {
  scenarioExecutions.add(1, { scenario: 'cancel_order' });
  console.log(`[SCENARIO] Starting cancel order flow - VU ${__VU}, Iter ${__ITER}`);
  
  const user = getUser();

  group('FlashSale Login', function () {
    const authToken = ensureUserAuthenticated(user);
    
    if (authToken) {
      const userPayload = getUserPayloadFromToken(authToken);
      let orderToCancelDetails = null;
      
      console.log(`[CANCEL ORDER FLOW] User: ${userPayload?.name || user.email}`);
      
      // Step 1: Create an order to cancel
      group('FlashSale Get Products', function () {
        const products = actionGetProducts(authToken);
        console.log(`[CANCEL] Retrieved ${products ? products.length : 0} products`);
        
        if (products && products.length > 0) {
          const productToOrder = products[Math.floor(Math.random() * products.length)];
          if (productToOrder && productToOrder.id) {
            // Clear cart first
            console.log(`[CANCEL] Clearing cart before creating order to cancel`);
            actionClearCart(authToken);
            
            let cartSuccess = false;
            group('FlashSale Add To Cart (Cancel Pre-step)', function () {
              console.log(`[CANCEL] Adding product ${productToOrder.id} to cart`);
              cartSuccess = actionAddToCart(authToken, productToOrder.id, 1);
            });
            
            if (cartSuccess) {
              sleep(0.2);
              console.log(`[CANCEL] Checking addresses`);
              const addresses = actionGetUserAddresses(authToken);
              if (addresses && addresses.length > 0) {
                const addressIdToUse = addresses[0].id;
                if (!addressIdToUse) {
                  console.error(`[CANCEL] Address has no ID`);
                  logError({ status: 'N/A', body: 'Address has no ID for cancel' }, 'CancelOrderFlow - AddressID');
                  flowCompletionRate.add(1, { flow: 'cancel_order', status: 'no_address' });
                  return;
                }
                
                group('FlashSale Create Order (for Cancellation)', function () {
                  console.log(`[CANCEL] Creating order to cancel with address ID: ${addressIdToUse}`);
                  orderToCancelDetails = actionCreateOrder(authToken, addressIdToUse);
                  if (orderToCancelDetails) {
                    logRequest('order_created_for_cancel', {
                      orderId: orderToCancelDetails.aliasId,
                      userEmail: user.email
                    });
                    
                    console.log(`[CANCEL] Order created for cancellation: ${orderToCancelDetails.aliasId}`);
                  }
                });
              } else {
                console.log(`[CANCEL] No addresses available`);
                logError({ status: 'N/A', body: 'No addresses for cancel pre-step' }, 'CancelOrderFlow - GetAddresses');
                flowCompletionRate.add(1, { flow: 'cancel_order', status: 'no_address' });
              }
            } else {
              console.error(`[CANCEL] Cart preparation failed`);
              flowCompletionRate.add(1, { flow: 'cancel_order', status: 'cart_failure' });
            }
          } else {
            console.error(`[CANCEL] Invalid product selected`);
            logError({status: 'N/A', body: 'Invalid product for cancel pre-step'}, 'cancelOrderFlow-SelectProduct');
            flowCompletionRate.add(1, { flow: 'cancel_order', status: 'no_product' });
          }
        } else {
          console.log(`[CANCEL] No products available`);
          flowCompletionRate.add(1, { flow: 'cancel_order', status: 'no_products' });
        }
      });
      
      sleep(1);

      if (orderToCancelDetails && orderToCancelDetails.aliasId) {
        group('FlashSale Cancel Order', function () {
          console.log(`[CANCEL] Cancelling order ${orderToCancelDetails.aliasId}`);
          const cancelSuccess = actionCancelOrder(authToken, orderToCancelDetails.aliasId);
          if (cancelSuccess) {
            logRequest('order_cancelled', {
              orderId: orderToCancelDetails.aliasId,
              userEmail: user.email,
              success: true
            });
            
            flowCompletionRate.add(1, { flow: 'cancel_order', status: 'success' });
            
            console.log(`[CANCEL SUCCESS] Order ${orderToCancelDetails.aliasId} cancelled`);
            
            // Verify cancellation
            if (__ENV.DEBUG === 'true') {
              const cancelledOrder = actionGetOrder(authToken, orderToCancelDetails.aliasId);
              if (cancelledOrder) {
                console.log(`[CANCEL VERIFY] Order status: ${cancelledOrder.status}`);
              }
            }
          } else {
            console.error(`[CANCEL] Failed to cancel order ${orderToCancelDetails.aliasId}`);
            flowCompletionRate.add(1, { flow: 'cancel_order', status: 'cancel_failure' });
          }
        });
      } else {
        console.log(`[CANCEL] No order created to cancel`);
        flowCompletionRate.add(1, { flow: 'cancel_order', status: 'no_order' });
      }
    } else {
      console.error(`[CANCEL] Authentication failed for user ${user.email}`);
      flowCompletionRate.add(1, { flow: 'cancel_order', status: 'auth_failure' });
    }
  });
  
  sleep(Math.random() * 2);
}

// Custom summary handler that exports request logs
export function handleSummary(data) {
  // Add request log summary
  const flowSummary = {
    totalRequests: requestLog.length,
    byType: {},
    byUser: {},
    byScenario: {},
    flowCompletions: {}
  };
  
  requestLog.forEach(log => {
    // Count by type
    flowSummary.byType[log.type] = (flowSummary.byType[log.type] || 0) + 1;
    
    // Count by user
    if (log.userEmail) {
      flowSummary.byUser[log.userEmail] = (flowSummary.byUser[log.userEmail] || 0) + 1;
    }
    
    // Count by scenario
    if (log.scenario) {
      flowSummary.byScenario[log.scenario] = (flowSummary.byScenario[log.scenario] || 0) + 1;
    }
  });
  
  // Add flow completion rates
  const metrics = data.metrics;
  if (metrics && metrics.flow_completion_rate) {
    flowSummary.flowCompletions = metrics.flow_completion_rate;
  }
  
  // Add scenario execution counts
  if (metrics && metrics.scenario_executions) {
    flowSummary.scenarioExecutions = metrics.scenario_executions;
  }
  
  data.customData = {
    flowSummary: flowSummary,
    sampleRequests: requestLog.slice(-100) // Last 100 requests
  };

  console.log('\n=== FLOW EXECUTION SUMMARY ===');
  console.log(`Total Requests Logged: ${flowSummary.totalRequests}`);
  console.log(`Scenario Executions:`, flowSummary.scenarioExecutions);
  console.log(`Flow Completions:`, flowSummary.flowCompletions);

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'request-log.json': JSON.stringify(requestLog, null, 2),
    'flow-summary.json': JSON.stringify(flowSummary, null, 2)
  };
}

// To run this enhanced version with detailed logging:
// ./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- DEBUG=true
//
// This will provide:
// - Detailed request/response logging in console
// - request-log.json with all operations
// - flow-summary.json with completion rates
// - summary.json with overall statistics
//
// The enhanced version ensures all flows are executed:
// - Reduced start time delays (0s, 1s, 2s, 3s)
// - Added detailed console logging for each flow
// - Track scenario executions to verify all flows run
// - Multiple products added to cart
// - Cart update and remove operations
// - Address creation and updates
// - Order history retrieval
// - Complete order lifecycle tracking