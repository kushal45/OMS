# Load Testing Guide for OMS Application

This guide explains how to run load tests for the OMS (Order Management System) application using k6 with visual monitoring through Grafana.

## Prerequisites

1. **k6 installed**: Download from https://k6.io/docs/getting-started/installation/
2. **Docker and Docker Compose**: For running monitoring stack
3. **OMS application running**: Ensure your application is accessible
4. **For k6 cloud**: k6 cloud account and authentication token

## Running Load Tests Locally

### Basic Flash Sale Test (Dynamic Users)

```bash
# Run with default settings (dynamic user generation)
k6 run load-tests/flash_sale.js

# Run with custom BASE_URL (for local testing)
k6 run load-tests/flash_sale.js -e BASE_URL=http://localhost:3000/api

# Run with custom user configuration
k6 run load-tests/flash_sale.js \
  -e BASE_URL=http://localhost:3000/api \
  -e USER_PREFIX=test_user \
  -e USER_DOMAIN=example.com \
  -e USER_PASSWORD=password123 \
  -e REUSE_USERS_PROBABILITY=0.7

# Run with custom VU configuration
k6 run load-tests/flash_sale.js \
  -e BASE_URL=http://localhost:3000/api \
  -e PEAK_VUS_REGISTER=5 \
  -e PEAK_VUS_ADD_CART=10 \
  -e PEAK_VUS_PLACE_ORDER=8 \
  -e PEAK_VUS_CANCEL_ORDER=3 \
  -e FLASH_SALE_DURATION=2m

# Enable debug logging
k6 run load-tests/flash_sale.js \
  -e BASE_URL=http://localhost:3000/api \
  -e DEBUG=true
```

### Using Static Users from users.json

```bash
# Create users.json file first
cat > load-tests/users.json << EOF
[
  {"email": "testuser1@example.com", "password": "password123"},
  {"email": "testuser2@example.com", "password": "password123"},
  {"email": "testuser3@example.com", "password": "password123"}
]
EOF

# Run with static users
k6 run load-tests/flash_sale.js \
  -e BASE_URL=http://localhost:3000/api \
  -e USE_DYNAMIC_USERS=false
```

## Running Load Tests on k6 Cloud

### Important: Your Application Must Be Publicly Accessible

k6 cloud cannot access `localhost`. You need to either:

1. **Deploy your application** to a public server
2. **Use ngrok** to create a public tunnel to your local application
3. **Use a staging/test environment** with a public URL

### Using ngrok (for local development)

```bash
# Install ngrok: https://ngrok.com/download

# Start your OMS application locally
# Then create a public tunnel
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Use this URL as your BASE_URL
```

### Running on k6 Cloud

```bash
# Login to k6 cloud
k6 login cloud

# Run with ngrok URL or public URL
k6 cloud run load-tests/flash_sale.js \
  -e BASE_URL=https://your-public-url.com/api \
  -e PEAK_VUS_REGISTER=1 \
  -e PEAK_VUS_ADD_CART=2 \
  -e PEAK_VUS_PLACE_ORDER=3 \
  -e PEAK_VUS_CANCEL_ORDER=1 \
  -e USER_PREFIX=cloud_test \
  -e USER_DOMAIN=test.com \
  -e USER_PASSWORD=securepass123 \
  -e REUSE_USERS_PROBABILITY=0.8

# For production/staging environment
k6 cloud run load-tests/flash_sale.js \
  -e BASE_URL=https://staging.yourapp.com/api \
  -e PEAK_VUS_REGISTER=10 \
  -e PEAK_VUS_ADD_CART=50 \
  -e PEAK_VUS_PLACE_ORDER=30 \
  -e PEAK_VUS_CANCEL_ORDER=10 \
  -e FLASH_SALE_DURATION=5m
```

## Environment Variables

### Required
- `BASE_URL`: The base URL of your API (default: `http://localhost:3000/api`)

### User Configuration
- `USE_DYNAMIC_USERS`: Use dynamic user generation (default: `true`)
- `USER_PREFIX`: Prefix for generated usernames (default: `flash_user`)
- `USER_DOMAIN`: Domain for generated emails (default: `example.com`)
- `USER_PASSWORD`: Password for all generated users (default: `password123`)
- `REUSE_USERS_PROBABILITY`: Probability of reusing existing users (default: `0.7`)

### Load Configuration
- `PEAK_VUS_REGISTER`: Peak VUs for registration scenario (default: `20`)
- `PEAK_VUS_ADD_CART`: Peak VUs for add to cart scenario (default: `80`)
- `PEAK_VUS_PLACE_ORDER`: Peak VUs for place order scenario (default: `60`)
- `PEAK_VUS_CANCEL_ORDER`: Peak VUs for cancel order scenario (default: `15`)
- `FLASH_SALE_DURATION`: Duration of the main test phase (default: `1m`)
- `RAMP_UP_TIME`: Time to ramp up to peak VUs (default: `10s`)
- `RAMP_DOWN_TIME`: Time to ramp down from peak VUs (default: `10s`)

### Other
- `DEBUG`: Enable debug logging (default: `false`)
- `CART_URL`: Direct cart service URL if needed (default: `http://localhost:3005/cart`)

## Troubleshooting

### "body is null" errors
- **Cause**: The API endpoint is not accessible from where k6 is running
- **Solution**: 
  - For local runs: Ensure your application is running and BASE_URL is correct
  - For cloud runs: Use a publicly accessible URL (not localhost)

### Authentication failures
- **Cause**: Users don't exist or wrong credentials
- **Solution**: 
  - Use dynamic users (default behavior)
  - Or ensure users in users.json exist in your system

### High error rates
- **Cause**: Application can't handle the load or network issues
- **Solution**: 
  - Start with lower VU counts
  - Check application logs for errors
  - Monitor system resources

## Example Scenarios

### Light Load Test (Development)
```bash
k6 run load-tests/flash_sale.js \
  -e BASE_URL=http://localhost:3000/api \
  -e PEAK_VUS_REGISTER=1 \
  -e PEAK_VUS_ADD_CART=2 \
  -e PEAK_VUS_PLACE_ORDER=2 \
  -e PEAK_VUS_CANCEL_ORDER=1 \
  -e FLASH_SALE_DURATION=30s
```

### Medium Load Test (Staging)
```bash
k6 cloud run load-tests/flash_sale.js \
  -e BASE_URL=https://staging.yourapp.com/api \
  -e PEAK_VUS_REGISTER=5 \
  -e PEAK_VUS_ADD_CART=20 \
  -e PEAK_VUS_PLACE_ORDER=15 \
  -e PEAK_VUS_CANCEL_ORDER=5 \
  -e FLASH_SALE_DURATION=2m
```

### Heavy Load Test (Performance Testing)
```bash
k6 cloud run load-tests/flash_sale.js \
  -e BASE_URL=https://staging.yourapp.com/api \
  -e PEAK_VUS_REGISTER=20 \
  -e PEAK_VUS_ADD_CART=100 \
  -e PEAK_VUS_PLACE_ORDER=80 \
  -e PEAK_VUS_CANCEL_ORDER=20 \
  -e FLASH_SALE_DURATION=10m
```

## Understanding the Results

The test will output:
- **http_req_duration**: Response time metrics
- **http_req_failed**: Percentage of failed requests
- **checks**: Percentage of passed checks
- **group_duration**: Time taken for each user flow
- Custom metrics for each action (register, login, add to cart, etc.)

Success criteria (thresholds):
- `http_req_failed`: Should be less than 5%
- `http_req_duration`: 95% of requests should complete within 2 seconds
- `checks`: More than 95% of checks should pass

## Visual Monitoring with Grafana (Recommended)

### Quick Start with Visual Monitoring

The easiest way to run load tests with visual monitoring:

```bash
# Basic usage (will start monitoring stack automatically)
./load-tests/run-load-test.sh


./load-tests/run-load-test.sh -f flash_sale_dynamic.js -- \
  PEAK_VUS_REGISTER=1 \
  PEAK_VUS_ADD_CART=2 \
  PEAK_VUS_PLACE_ORDER=2 \
  FLASH_SALE_DURATION=10s

# With custom parameters
./load-tests/run-load-test.sh -f flash_sale.js -u http://localhost:3000/api -- \
  PEAK_VUS_REGISTER=5 \
  PEAK_VUS_ADD_CART=10 \
  PEAK_VUS_PLACE_ORDER=8 \
  PEAK_VUS_CANCEL_ORDER=3 \
  FLASH_SALE_DURATION=2m
```

### Manual Setup

1. **Start the monitoring stack**:
```bash
docker-compose -f load-tests/docker-compose.monitoring.yml up -d influxdb grafana
```

2. **Access Grafana**:
- URL: http://localhost:3030
- Username: admin
- Password: admin123
- Dashboard: "k6 Load Testing Results" (auto-loaded)

3. **Run load test with InfluxDB output**:
```bash
k6 run --out influxdb=http://localhost:8086/k6 \
  -e BASE_URL=http://localhost:3000/api \
  -e PEAK_VUS_ADD_CART=10 \
  -e PEAK_VUS_PLACE_ORDER=5 \
  load-tests/flash_sale.js
```

### Running Tests Against Dockerized APIs

If your OMS application is running in Docker:

```bash
# For Mac/Windows Docker Desktop
./load-tests/run-load-test.sh -u http://host.docker.internal:3000/api

# For Linux
./load-tests/run-load-test.sh -u http://172.17.0.1:3000/api

# Or use the service name if on the same network
./load-tests/run-load-test.sh -u http://api-gateway:3000/api
```

### Grafana Dashboard Features

The pre-configured dashboard shows:
- **Virtual Users**: Active VUs over time
- **Request Rate**: Requests per second
- **Response Time**: p95, p90, and median response times
- **Error Rate**: Percentage of failed requests
- **Group Duration**: Time taken for each user flow (login, add to cart, place order, etc.)

### Stopping the Monitoring Stack

```bash
# Stop and remove containers
docker-compose -f load-tests/docker-compose.monitoring.yml down

# Stop and remove containers with data
docker-compose -f load-tests/docker-compose.monitoring.yml down -v
```

## Alternative: Using k6 HTML Report

If you prefer not to use Docker/Grafana, you can generate HTML reports:

```bash
# Install k6-reporter
npm install -g k6-reporter

# Run test and generate JSON output
k6 run --out json=test-results.json load-tests/flash_sale.js

# Convert to HTML report
k6-reporter test-results.json --output test-report.html

# Open the report
open test-report.html
```

## Best Practices for Local Load Testing

1. **Start Small**: Begin with low VU counts to ensure everything works
2. **Monitor Resources**: Watch CPU, memory, and network usage on your machine
3. **Use Realistic Data**: The dynamic user generation simulates real user behavior
4. **Incremental Load**: Gradually increase load to find breaking points
5. **Multiple Runs**: Run tests multiple times to ensure consistent results

## Comparing Results

When using visual monitoring, you can:
- Compare different test runs by adjusting the time range in Grafana
- Export dashboard snapshots for documentation
- Set up alerts for performance degradation
- Analyze patterns and bottlenecks visually

## Docker Network Configuration

If your OMS application is running in Docker, ensure proper network configuration:

```yaml
# In your OMS docker-compose.yml, ensure you have:
networks:
  oms_default:
    driver: bridge

# The monitoring stack will connect to this network
```

## Troubleshooting Visual Monitoring

### Grafana not showing data
- Check InfluxDB is running: `docker ps | grep influxdb`
- Verify k6 is sending data: Look for `output: influxdb` in k6 output
- Check time range in Grafana (top right corner)

### Connection refused errors
- For Mac/Windows: Use `host.docker.internal` instead of `localhost`
- For Linux: Use `172.17.0.1` or the Docker bridge IP
- Ensure your application is binding to `0.0.0.0` not just `127.0.0.1`

### Performance issues
- Reduce VU count if your machine is struggling
- Close other applications to free up resources
- Consider running tests on a dedicated machine

## Advanced API Request/Response Monitoring

### Enhanced Grafana Dashboard

We provide two Grafana dashboards:

1. **k6 Load Testing Results** - Basic metrics dashboard
2. **k6 Detailed API Monitoring** - Enhanced dashboard with:
   - API requests grouped by status code
   - Requests by endpoint (pie chart)
   - Response time by endpoint
   - Detailed API request table showing:
     - HTTP Method
     - Endpoint URL
     - Status Code
     - Request Count
     - Average Duration
   - Status codes over time (stacked area chart)

### Viewing Detailed Request Information

The enhanced dashboard includes:

1. **Status Code Distribution**:
   - Visual breakdown of 2xx, 4xx, 5xx responses
   - Color-coded for quick identification (green/yellow/red)

2. **API Request Details Table**:
   - Shows every unique endpoint hit during the test
   - Displays method, endpoint, status, count, and average duration
   - Sortable by any column
   - Color-coded status codes

3. **Request Payload Logging** (Debug Mode):
   ```bash
   # Enable debug mode to log request/response details
   ./load-tests/run-load-test.sh -- DEBUG=true
   ```

### Using Enhanced Auth Actions

For more detailed metrics, use the enhanced auth actions:

```javascript
// In your test file, replace:
import { registerUser, loginUser } from './auth_actions.js';

// With:
import { registerUser, loginUser } from './auth_actions_enhanced.js';
```

This provides:
- Request/response logging in debug mode
- Detailed metrics by endpoint
- Status code tracking
- Payload size tracking

### Exporting Detailed Request Logs

For even more detailed analysis, use the request logger:

```javascript
// In your test file
import { httpWithLogging, handleSummary } from './k6-request-logger.js';

// Use httpWithLogging instead of http
const response = httpWithLogging('POST', `${BASE_URL}/auth/login`, payload, params);

// Export handleSummary
export { handleSummary };
```

This will generate:
- `summary.json` - Complete test summary
- `request-details.json` - All request/response details

### Analyzing Results

1. **In Grafana**:
   - Filter by time range to focus on specific test phases
   - Click on table rows to see trends for specific endpoints
   - Use the status code chart to identify error patterns

2. **From JSON exports**:
   ```bash
   # View error requests
   jq '.customData.detailedErrors' summary.json
   
   # Count requests by status
   jq '.customData.requests.byStatus' summary.json
   
   # Find slow endpoints
   jq '.[] | select(.response.duration > 1000)' request-details.json
   ```

3. **Real-time monitoring**:
   - Watch the Grafana dashboard during test execution
   - Identify performance degradation as load increases
   - Spot error spikes immediately

### Custom Metrics

You can add custom metrics for specific needs:

```javascript
import { Counter, Trend } from 'k6/metrics';

// Track custom business metrics
const ordersCreated = new Counter('orders_created');
const orderCreationTime = new Trend('order_creation_time');

// In your test
if (orderResponse.status === 201) {
  ordersCreated.add(1);
  orderCreationTime.add(orderResponse.timings.duration);
}
```

These will automatically appear in Grafana if you use the InfluxDB output.

## Using Enhanced Load Tests with Full Request/Response Logging

### Running the Enhanced Flash Sale Test

The enhanced version provides complete request/response logging for all API calls:

```bash
# Run with full debug logging
./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- DEBUG=true

# Run with specific configuration
./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- \
  DEBUG=true \
  PEAK_VUS_ADD_CART=5 \
  PEAK_VUS_PLACE_ORDER=3 \
  PEAK_VUS_CANCEL_ORDER=1 \
  FLASH_SALE_DURATION=40s
```

### What the Enhanced Version Logs

1. **Authentication Flow**:
   ```
   [POST] /auth/login
   [REQUEST] Payload: {"email":"test@example.com","password":"password123"}
   [RESPONSE] Status: 200
   [RESPONSE] Duration: 125ms
   [RESPONSE] Body: {"accessToken":"eyJ..."}
   ```

2. **Cart Operations**:
   ```
   [POST] /items
   [REQUEST] Payload: {"productId":"123","quantity":1}
   [RESPONSE] Status: 201
   [CART SUCCESS] Product 123 added to cart
   [CART CONTENTS] Total items: 1
   [CART CONTENTS] Total amount: 99.99
   ```

3. **Order Creation**:
   ```
   [POST] /orders
   [REQUEST] Payload: {"addressId":"456"}
   [RESPONSE] Status: 201
   [ORDER SUCCESS] Order created:
     Order ID: ORD-789
     Status: PENDING
     Total Amount: 99.99
   [ORDER LIFECYCLE] Tracking order ORD-789
   [ORDER LIFECYCLE] Current status: PENDING
   [ORDER LIFECYCLE] Items count: 1
   ```

4. **Error Details**:
   ```
   [ERROR] Failed request to /orders
   [ERROR] Full response: {"error":"Insufficient inventory","code":"OUT_OF_STOCK"}
   ```

### Enhanced Metrics in Grafana

The enhanced version tracks additional metrics:

1. **By Endpoint**:
   - Request count per endpoint
   - Average response time per endpoint
   - Error rate per endpoint

2. **By Status Code**:
   - Detailed breakdown of all status codes
   - Time-series view of status code distribution

3. **By Operation**:
   - Performance metrics for each business operation
   - Success/failure rates for critical flows

### Analyzing Enhanced Results

1. **During Test Execution**:
   - Watch console output for real-time request/response details
   - Monitor Grafana for performance trends
   - Identify failing requests immediately

2. **After Test Completion**:
   ```bash
   # View all failed requests
   jq '.[] | select(.response.status >= 400)' request-details.json | less
   
   # Find slowest requests
   jq '.[] | select(.response.duration > 1000) | {url, duration: .response.duration}' request-details.json
   
   # Extract all order creation requests
   jq '.[] | select(.url | contains("/orders")) | select(.method == "POST")' request-details.json
   
   # Get summary of errors by endpoint
   jq -r '.[] | select(.response.status >= 400) | "\(.method) \(.url): \(.response.status)"' request-details.json | sort | uniq -c
   ```

3. **Debugging Specific Issues**:
   ```bash
   # Find all requests for a specific user
   jq '.[] | select(.payload | contains("user@example.com"))' request-details.json
   
   # Track a specific order through the system
   ORDER_ID="ORD-123"
   jq --arg id "$ORDER_ID" '.[] | select(.url | contains($id) or .response.body | contains($id))' request-details.json
   ```

### Best Practices for Enhanced Testing

1. **Start with Debug Off**: Run without DEBUG first to get baseline performance
2. **Enable Debug for Issues**: Turn on DEBUG when investigating failures
3. **Use Filters**: Focus on specific endpoints or operations when debugging
4. **Monitor Resources**: Debug logging increases memory usage
5. **Analyze Patterns**: Look for common failure patterns across requests

### Comparing Standard vs Enhanced

| Feature | Standard | Enhanced |
|---------|----------|----------|
| Basic Metrics | ✓ | ✓ |
| Status Code Tracking | Basic | Detailed |
| Request Logging | ✗ | ✓ |
| Response Body Logging | ✗ | ✓ |
| Operation Tracking | ✗ | ✓ |
| Debug Mode | ✗ | ✓ |
| JSON Export | Basic | Complete |

Use the enhanced version when you need to:
- Debug API failures
- Analyze request/response patterns
- Track specific user journeys
- Validate API contracts
- Investigate performance issues

## Pre-creating Test Users for Reliable Load Testing

### Why Pre-create Users?

Pre-creating users ensures:
- All flows (cart, order, address) execute without authentication issues
- Consistent test results across runs
- No registration overhead during load testing
- Users already have addresses configured

### Step 1: Create Test Users

Use the setup script to create users with addresses:

```bash
# Create 10 test users (default)
./load-tests/setup-test-users.sh

# Create custom number of users
NUM_USERS=20 ./load-tests/setup-test-users.sh

# With custom configuration
BASE_URL=http://localhost:3000/api \
NUM_USERS=15 \
USER_PREFIX=perf_test \
USER_DOMAIN=loadtest.com \
./load-tests/setup-test-users.sh
```

This script will:
1. Register each user
2. Verify login works
3. Create a default shipping address
4. Save user credentials to `load-tests/users.json`

### Step 2: Verify users.json

Check that `load-tests/users.json` was created:

```bash
cat load-tests/users.json
```

Should contain:
```json
[
  {
    "email": "loadtest_1234567890_1@example.com",
    "password": "password123",
    "name": "loadtest User 1",
    "hasAddress": true
  },
  ...
]
```

### Step 3: Run Load Test with Pre-created Users

```bash
# Use the pre-created users (USE_DYNAMIC_USERS=false)
./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- \
  USE_DYNAMIC_USERS=false \
  DEBUG=true \
  PEAK_VUS_ADD_CART=3 \
  PEAK_VUS_PLACE_ORDER=3 \
  PEAK_VUS_CANCEL_ORDER=1 \
  FLASH_SALE_DURATION=40s
```

### Manual User Creation

If the script doesn't work, manually create `load-tests/users.json`:

```json
[
  {
    "email": "testuser1@example.com",
    "password": "password123"
  },
  {
    "email": "testuser2@example.com",
    "password": "password123"
  },
  {
    "email": "testuser3@example.com",
    "password": "password123"
  }
]
```

Then register these users manually or via API before running tests.

### Troubleshooting Pre-created Users

1. **Login failures**: Ensure users exist in your database
2. **No addresses**: Run setup script or manually add addresses
3. **Authentication errors**: Check password matches what's in database
4. **Missing users.json**: Re-run setup script or create manually

### Benefits of Pre-created Users

1. **Reliability**: No registration failures during load test
2. **Performance**: Skip registration overhead
3. **Consistency**: Same users across test runs
4. **Complete Setup**: Users have addresses ready

### Switching Between Dynamic and Static Users

```bash
# Dynamic users (created on-the-fly)
./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- \
  USE_DYNAMIC_USERS=true

# Static users (from users.json)
./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- \
  USE_DYNAMIC_USERS=false
```

### Enhanced Action Modules

The enhanced version uses specialized action modules:

1. **auth_actions_enhanced.js**: Tracks authentication requests with full logging
2. **cart_actions_enhanced.js**: Monitors cart operations and contents
3. **order_actions_enhanced.js**: Tracks order lifecycle and status changes

Each enhanced module provides:
- Detailed request/response logging
- Custom metrics per endpoint
- Error tracking and reporting
- Debug mode with verbose output

To use enhanced modules in your own tests:

```javascript
// Import enhanced actions
import { registerUser, loginUser } from './auth_actions_enhanced.js';
import { addToCart, getCart } from './cart_actions_enhanced.js';
import { createOrder, trackOrderLifecycle } from './order_actions_enhanced.js';

// Use with debug logging
const authToken = loginUser(email, password); // Will log full request/response in DEBUG mode
const order = createOrder(authToken, addressId); // Will log order details
trackOrderLifecycle(authToken, order.aliasId); // Will log order status and items
```