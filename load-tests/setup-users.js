import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const NUM_USERS = parseInt(__ENV.NUM_USERS || '10');
const USER_PREFIX = __ENV.USER_PREFIX || 'loadtest';
const USER_DOMAIN = __ENV.USER_DOMAIN || 'example.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || 'password123';

// This is a setup script, run only once
export const options = {
  vus: 1,
  iterations: 1,
  setupTimeout: '300s',
};

// Store successfully created users
const createdUsers = [];

export default function() {
  console.log(`\n=== SETTING UP ${NUM_USERS} TEST USERS ===\n`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User Prefix: ${USER_PREFIX}`);
  console.log(`User Domain: ${USER_DOMAIN}\n`);

  for (let i = 1; i <= NUM_USERS; i++) {
    const timestamp = Date.now();
    const userEmail = `${USER_PREFIX}_${timestamp}_${i}@${USER_DOMAIN}`;
    const userName = `${USER_PREFIX} User ${i}`;
    
    console.log(`[${i}/${NUM_USERS}] Creating user: ${userEmail}`);
    
    // Register user
    const registerPayload = JSON.stringify({
      name: userName,
      email: userEmail,
      password: USER_PASSWORD
    });
    
    const registerParams = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const registerRes = http.post(`${BASE_URL}/auth/register`, registerPayload, registerParams);
    
    const registerSuccess = check(registerRes, {
      'Registration successful': (r) => r.status === 201,
      'Has user ID': (r) => {
        try {
          return r.json('data.id') !== null;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (registerSuccess) {
      // Test login to verify user works
      const loginPayload = JSON.stringify({
        email: userEmail,
        password: USER_PASSWORD
      });
      
      const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, registerParams);
      
      const loginSuccess = check(loginRes, {
        'Login successful': (r) => r.status === 200,
        'Has access token': (r) => {
          try {
            const responseData = r.json();
            // Handle both formats: data.accessToken or direct accessToken
            return (responseData.data && responseData.data.accessToken) || responseData.accessToken;
          } catch (e) {
            return false;
          }
        }
      });
      
      if (loginSuccess) {
        // Extract token from either format
        const responseData = loginRes.json();
        const authToken = responseData.data?.accessToken || responseData.accessToken;
        
        // Create a default address for the user
        const addressPayload = JSON.stringify({
          street: `${i} Test Street`,
          city: "TestCity",
          state: "TS",
          zipCode: "12345",
          country: "TC",
          isDefault: true,
          addressType: "SHIPPING"
        });
        
        const addressParams = {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
        };
        
        const addressRes = http.post(`${BASE_URL}/auth/addresses`, addressPayload, addressParams);
        
        const addressSuccess = check(addressRes, {
          'Address created': (r) => r.status === 201 || r.status === 200
        });
        
        // Store user info
        const userInfo = {
          email: userEmail,
          password: USER_PASSWORD,
          name: userName,
          hasAddress: addressSuccess
        };
        
        createdUsers.push(userInfo);
        console.log(`  ✓ User created successfully (with address: ${addressSuccess})`);
      } else {
        console.error(`  ✗ Login failed for ${userEmail}: ${loginRes.status}`);
      }
    } else {
      console.error(`  ✗ Registration failed for ${userEmail}: ${registerRes.status}`);
      if (registerRes.body) {
        console.error(`    Response: ${registerRes.body}`);
      }
    }
    
    // Small delay between user creations
    if (i < NUM_USERS) {
      sleep(0.5);
    }
  }
  
  console.log(`\n=== SETUP COMPLETE ===`);
  console.log(`Successfully created ${createdUsers.length} out of ${NUM_USERS} users\n`);
  
  // Write users to a file (this is logged, you'll need to copy manually)
  console.log('Copy the following JSON to load-tests/users.json:');
  console.log('----------------------------------------');
  console.log(JSON.stringify(createdUsers, null, 2));
  console.log('----------------------------------------');
  
  // Also create a simpler version for backward compatibility
  const simpleUsers = createdUsers.map(u => ({
    email: u.email,
    password: u.password
  }));
  
  console.log('\nOr use this simplified version:');
  console.log('----------------------------------------');
  console.log(JSON.stringify(simpleUsers, null, 2));
  console.log('----------------------------------------');
}

// Summary handler
export function handleSummary(data) {
  const summary = {
    setup: {
      requested: NUM_USERS,
      created: createdUsers.length,
      failed: NUM_USERS - createdUsers.length
    },
    users: createdUsers
  };
  
  return {
    'stdout': `\nSetup Summary:\n` +
              `  Requested: ${summary.setup.requested}\n` +
              `  Created: ${summary.setup.created}\n` +
              `  Failed: ${summary.setup.failed}\n`,
    'setup-users.json': JSON.stringify(summary, null, 2),
    'users.json': JSON.stringify(createdUsers, null, 2)
  };
}