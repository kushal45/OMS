// Alternative JWT decoder for k6 that doesn't rely on k6's b64decode
// This provides a fallback implementation if the built-in decoder has issues

export function decodeJWT(token) {
  if (!token) {
    console.error('No token provided to decodeJWT');
    return null;
  }

  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Split the JWT token
    const parts = cleanToken.split('.');
    
    if (parts.length !== 3) {
      console.error(`Invalid JWT format: Expected 3 parts, got ${parts.length}`);
      return null;
    }
    
    // Get the payload (second part)
    const payload = parts[1];
    
    // Manual base64url decode
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) {
        throw new Error('Invalid base64 string');
      }
      base64 += new Array(5 - pad).join('=');
    }
    
    // Decode base64 to string
    const decoded = atob(base64);
    
    // Parse JSON
    const data = JSON.parse(decoded);
    
    console.log(`Successfully decoded JWT for user: ${data.email || data.id || 'unknown'}`);
    
    return {
      id: data.id || data.sub || data.userId,
      email: data.email,
      name: data.name || data.username,
      iat: data.iat,
      exp: data.exp
    };
  } catch (error) {
    console.error(`Error in decodeJWT: ${error.message}`);
    return null;
  }
}

// Simple base64 decode implementation
function atob(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }

  for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
}

// Export as default for easy switching
export default decodeJWT;