import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'; // For unique email addresses
import { getUserPayloadFromToken, isTokenExpired } from '../common.js'; // Import JWT utilities

// --- Configuration ---
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api'; // API Gateway URL
const VUS = parseInt(__ENV.VUS || '5');
const DURATION = __ENV.DURATION || '10s';
const RAMP_UP_TIME = __ENV.RAMP_UP_TIME || '5s';
const RAMP_DOWN_TIME = __ENV.RAMP_DOWN_TIME || '5s';

// --- k6 Options ---
export const options = {
  stages: [
    { duration: RAMP_UP_TIME, target: VUS }, // Ramp up to VUS
    { duration: DURATION, target: VUS },     // Stay at VUS
    { duration: RAMP_DOWN_TIME, target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'], // http errors should be less than 1%
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'checks': ['rate>0.99'], // 99% of checks should pass
    'group_duration{group:::Auth API Register}': ['p(95)<600'],
    'group_duration{group:::Auth API Login}': ['p(95)<400'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// --- Custom Metrics ---
const registerReqDuration = new Trend('register_req_duration');
const loginReqDuration = new Trend('login_req_duration');
const errorRate = new Rate('errors');
const registrationSuccessCounter = new Counter('registrations_successful');
const loginSuccessCounter = new Counter('logins_successful');

// --- Test Logic ---
export default function () {
  const userEmail = `testuser_${uuidv4()}@example.com`;
  const userName = `Test User ${uuidv4().substring(0, 8)}`;
  const userPassword = 'password123';
  let authToken = null;

  group('Auth API Register', function () {
    const registerPayload = JSON.stringify({
      name: userName,
      email: userEmail,
      password: userPassword,
    });
    const registerParams = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const registerRes = http.post(`${BASE_URL}/auth/register`, registerPayload, registerParams);
    
    registerReqDuration.add(registerRes.timings.duration);
    const registerCheck = check(registerRes, {
      'Registration: status is 201': (r) => r.status === 201,
      'Registration: response body contains ID': (r) => r.json('data.id') !== null && r.json('data.id') !== undefined,
    });
    if (registerCheck) {
        registrationSuccessCounter.add(1);
    } else {
        errorRate.add(1);
        console.error(`Registration failed: ${registerRes.status} - ${registerRes.body}`);
    }
  });

  sleep(1); // Small pause between registration and login

  group('Auth API Login', function () {
    const loginPayload = JSON.stringify({
      email: userEmail, // Use the email of the user just registered
      password: userPassword,
    });
    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

    loginReqDuration.add(loginRes.timings.duration);
    const loginCheck = check(loginRes, {
      'Login: status is 200': (r) => r.status === 200, // Assuming 200 for successful login
      'Login: response contains accessToken': (r) => r.json('accessToken') !== null && r.json('accessToken') !== undefined,
    });

    if (loginCheck) {
      loginSuccessCounter.add(1);
      authToken = loginRes.json('accessToken');
      
      // Extract and verify user payload from JWT
      const userPayload = getUserPayloadFromToken(authToken);
      if (userPayload) {
        // Verify the payload contains expected user data
        check(userPayload, {
          'JWT contains user ID': (p) => p.id !== null && p.id !== undefined,
          'JWT contains correct email': (p) => p.email === userEmail,
          'JWT contains user name': (p) => p.name !== null && p.name !== undefined,
          'JWT token is not expired': () => !isTokenExpired(authToken),
        });
        
        // Log user info for debugging (optional)
        if (__ENV.DEBUG === 'true') {
          console.log(`User logged in - ID: ${userPayload.id}, Email: ${userPayload.email}, Name: ${userPayload.name}`);
        }
      } else {
        console.error(`Failed to decode JWT token for user ${userEmail}`);
        errorRate.add(1);
      }
    } else {
      errorRate.add(1);
      console.error(`Login failed: ${loginRes.status} - ${loginRes.body} for user ${userEmail}`);
    }
  });

  // Add more actions here if needed, e.g., using the authToken

  sleep(1); // Think time at the end of the iteration
}