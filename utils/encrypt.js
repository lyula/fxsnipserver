const crypto = require('crypto');

// Use a 32-byte key for AES-256
const ENCRYPTION_KEY_STRING = process.env.MESSAGE_ENCRYPTION_KEY || 'changemechangemechangemechangeme'; // 32 chars

// Ensure the key is exactly 32 bytes
function getValidKey() {
  const key = Buffer.from(ENCRYPTION_KEY_STRING, 'utf8');
  if (key.length === 32) {
    return key;
  } else if (key.length > 32) {
    return key.subarray(0, 32);
  } else {
    // Pad with zeros if too short
    const paddedKey = Buffer.alloc(32, 0);
    key.copy(paddedKey);
    return paddedKey;
  }
}

const ENCRYPTION_KEY = getValidKey();
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Return original text if encryption fails
  }
}

function decrypt(text) {
  if (!text) return '';
  
  // If text doesn't contain ':', it's likely not encrypted (plain text)
  if (!text.includes(':')) {
    return text;
  }
  
  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      console.warn('Invalid encrypted text format, returning as plain text');
      return text;
    }
    
    const [ivBase64, encrypted] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    
    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      console.warn('Invalid IV length, returning as plain text');
      return text;
    }
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '[decryption error]'; // Return error message if decryption fails
  }
}

module.exports = { encrypt, decrypt };
