// Test script to verify JWT decoding functionality
import { getUserPayloadFromToken } from './common.js';
import { decodeJWT } from './jwt-decoder.js';

export default function() {
  // Sample JWT token for testing (you can replace with an actual token from your system)
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Vg30C57s3l90JNap_VgMhKZjfc-p7SoBXaSAy8c6BS8';
  
  console.log('=== Testing JWT Decoders ===');
  
  // Test k6 decoder
  console.log('\n1. Testing k6 decoder (getUserPayloadFromToken):');
  const k6Result = getUserPayloadFromToken(sampleToken);
  if (k6Result) {
    console.log('✓ k6 decoder succeeded:');
    console.log(JSON.stringify(k6Result, null, 2));
  } else {
    console.log('✗ k6 decoder failed');
  }
  
  // Test fallback decoder
  console.log('\n2. Testing fallback decoder (decodeJWT):');
  const fallbackResult = decodeJWT(sampleToken);
  if (fallbackResult) {
    console.log('✓ Fallback decoder succeeded:');
    console.log(JSON.stringify(fallbackResult, null, 2));
  } else {
    console.log('✗ Fallback decoder failed');
  }
  
  // Test with Bearer prefix
  console.log('\n3. Testing with Bearer prefix:');
  const bearerToken = `Bearer ${sampleToken}`;
  const bearerResult = getUserPayloadFromToken(bearerToken);
  if (bearerResult) {
    console.log('✓ Bearer token decoded successfully');
  } else {
    console.log('✗ Bearer token decoding failed');
  }
  
  // Test with invalid token
  console.log('\n4. Testing with invalid token:');
  const invalidToken = 'invalid.token.here';
  const invalidResult = getUserPayloadFromToken(invalidToken);
  if (!invalidResult) {
    console.log('✓ Invalid token correctly rejected');
  } else {
    console.log('✗ Invalid token was incorrectly accepted');
  }
  
  console.log('\n=== Test Complete ===');
}

// Run options
export const options = {
  vus: 1,
  iterations: 1,
};