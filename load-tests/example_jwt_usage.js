import http from 'k6/http';
import { check } from 'k6';
import { getUserPayloadFromToken, isTokenExpired, BASE_URL, defaultParams } from './common.js';

export const options = {
  vus: 1,
  duration: '10s',
};

export default function () {
  // Example 1: Login and extract user payload
  const loginPayload = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, defaultParams);
  
  if (check(loginRes, { 'login successful': (r) => r.status === 200 })) {
    const authToken = loginRes.json('accessToken');
    
    // Extract user payload from JWT token
    const userPayload = getUserPayloadFromToken(authToken);
    
    if (userPayload) {
      console.log('User Payload:', JSON.stringify(userPayload));
      console.log(`User ID: ${userPayload.id}`);
      console.log(`User Email: ${userPayload.email}`);
      console.log(`User Name: ${userPayload.name}`);
      
      // Check if token is expired
      if (isTokenExpired(authToken)) {
        console.log('Token is expired!');
      } else {
        console.log('Token is still valid');
      }
      
      // Use the user ID from payload for other operations
      // For example, you could use it to construct user-specific URLs or validate responses
      const userId = userPayload.id;
      
      // Example: Get user-specific data using the extracted user ID
      const userDataRes = http.get(`${BASE_URL}/api/users/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      check(userDataRes, {
        'user data retrieved': (r) => r.status === 200,
        'correct user returned': (r) => r.json('id') === userId,
      });
    } else {
      console.error('Failed to decode JWT token');
    }
  }
}