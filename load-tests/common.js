// load-tests/common.js
import { Rate } from 'k6/metrics';
import { b64decode } from 'k6/encoding'; // Import b64decode
import { decodeJWT } from './jwt-decoder.js'; // Import fallback decoder

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const BASE_CART_URL = __ENV.CART_URL || 'http://localhost:3005';
export const BASE_PRODUCT_URL = __ENV.PRODUCT_URL || 'http://localhost:3004';
export const GENERAL_ERROR_RATE = new Rate('common_general_errors');

// Flag to use fallback JWT decoder if k6's decoder fails
let USE_FALLBACK_DECODER = true;

// Polyfill/Helper for Uint8Array to UTF-8 string conversion in k6/Goja
// This function correctly converts the bytes from the Uint8Array into a UTF-8 string.
function decodeUint8ArrayToString(uint8array) {
  // Use TextDecoder if it were available (it's not in k6/Goja directly)
  // return new TextDecoder('utf-8').decode(uint8array);

  // Manual conversion: This works for valid UTF-8 JSON.
  // For more complex multi-byte character decoding, a more sophisticated
  // UTF-8 decoder might be needed, but for standard JSON payloads, this is usually sufficient.
  let str = '';
  for (let i = 0; i < uint8array.length; i++) {
    str += String.fromCharCode(uint8array[i]);
  }
  return str;
}

// Helper function to add proper base64url padding
function addBase64Padding(base64url) {
  // Base64url strings may have padding stripped. We need to add it back.
  const padding = base64url.length % 4;
  if (padding === 2) {
    return base64url + '==';
  } else if (padding === 3) {
    return base64url + '=';
  }
  return base64url;
}

export function getUserPayloadFromToken(token) {

  if (!token) {
    console.error('No token provided to getUserPayloadFromToken');
    GENERAL_ERROR_RATE.add(1);
    return null;
  }

  // Use fallback decoder if flag is set or try it after k6 decoder fails
  if (USE_FALLBACK_DECODER) {
    console.log('Using fallback JWT decoder');
    return decodeJWT(token);
  }

  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Log the token being processed for debugging purposes
    // Using substring to avoid logging extremely long tokens, adjust length as needed
    console.log(`DEBUG: Processing token: ${cleanToken.substring(0, 100)}...`);
    
    // Split the JWT token into its three parts (header, payload, signature)
    const parts = cleanToken.split('.');
    
    if (parts.length !== 3) {
      console.error(`Invalid JWT token format: Expected 3 parts (header.payload.signature), but got ${parts.length}`);
      GENERAL_ERROR_RATE.add(1);
      return null;
    }
    
    // The payload is the second part of the JWT (index 1)
    let base64Url = parts[1];
    
    // Add proper padding if needed
    base64Url = addBase64Padding(base64Url);
    
    // Log the base64url payload for debugging
    console.log(`DEBUG: Base64url payload length: ${base64Url.length}, first 50 chars: ${base64Url.substring(0, 50)}`);
    
    // Use k6's b64decode with the 'url' variant, which correctly handles
    // the base64url encoding used in JWTs (replaces '-' with '+' and '_' with '/', and handles padding).
    // This function returns a Uint8Array.
    const decodedPayloadBytes = b64decode(base64Url, 'url');
    
    // Log the decoded bytes length
    console.log(`DEBUG: Decoded payload bytes length: ${decodedPayloadBytes.length}`);
    
    // Crucial step: Convert the Uint8Array of bytes into a proper UTF-8 string
    // that JSON.parse can understand. This replaces the problematic .toString() call.
    const payloadString = decodeUint8ArrayToString(decodedPayloadBytes);

    // Log the resulting string BEFORE parsing it as JSON for verification
    console.log(`DEBUG: Decoded payload string length: ${payloadString.length}`);
    console.log(`DEBUG: Decoded payload string (first 200 chars): ${payloadString.substring(0, 200)}...`);
    
    // Check if the payload string is empty or truncated
    if (!payloadString || payloadString.trim() === '') {
      console.error('ERROR: Decoded payload string is empty');
      GENERAL_ERROR_RATE.add(1);
      return null;
    }

    // Parse the payload string as a JSON object
    const payload = JSON.parse(payloadString);
    
    // Log successful parsing
    console.log(`DEBUG: Successfully parsed JWT payload for user: ${payload.email || payload.id || 'unknown'}`);
    
    // Return the specific user fields from the decoded payload
    return {
      id: payload.id || payload.sub || payload.userId, // Handle different claim names
      email: payload.email,
      name: payload.name || payload.username,
      // Include token metadata if needed
      iat: payload.iat, // Issued at timestamp
      exp: payload.exp  // Expiration timestamp
    };
  } catch (error) {
    // Log the specific error message and potentially the error type for better debugging
    console.error(`Error decoding JWT token in getUserPayloadFromToken: ${error.message}`);
    console.error(`DEBUG: Error occurred at token processing stage`);
    
    // Try fallback decoder if k6's decoder failed
    if (!USE_FALLBACK_DECODER) {
      console.log('k6 decoder failed, trying fallback JWT decoder...');
      USE_FALLBACK_DECODER = true;
      const result = decodeJWT(token);
      if (result) {
        console.log('Fallback decoder succeeded! Will use it for future requests.');
        return result;
      }
      USE_FALLBACK_DECODER = false; // Reset if fallback also failed
    }
    
    GENERAL_ERROR_RATE.add(1);
    return null;
  }
}

/**
 * Checks if a JWT token is expired
 * @param {string} token - The JWT token to check
 * @returns {boolean} True if the token is expired, false otherwise
 */
export function isTokenExpired(token) {
  const payload = getUserPayloadFromToken(token);
  
  if (!payload || !payload.exp) {
    // If payload couldn't be retrieved or lacks an expiration, consider it expired for safety
    return true; 
  }
  
  // Get current time in seconds since epoch
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Compare current time with the expiration time from the token
  return currentTime > payload.exp;
}

export function logError(response, actionName, details = "") {
  GENERAL_ERROR_RATE.add(1);
  let errorBody = '';
  try {
    // Attempt to parse the response body as JSON for better readability
    const jsonBody = response.json();
    errorBody = JSON.stringify(jsonBody, null, 2); // Pretty print JSON
  } catch (e) {
    // If not valid JSON, use the raw body (or a truncated version)
    errorBody = response.body ? response.body.substring(0, 500) : 'No response body'; // Limit length
  }
  
  console.error(
    `ERROR in ${actionName}: VU=${__VU} ITER=${__ITER} | Status=${response.status} | URL=${response.url} | ErrorCode=${response.error_code || 'N/A'} | Body: ${errorBody} | Details: ${details}`
  );
}

export const defaultParams = {
  headers: {
    'Content-Type': 'application/json',
  },
};

export function getAuthenticatedParams(authToken) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };
}