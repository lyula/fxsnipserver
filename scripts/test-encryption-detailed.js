require('dotenv').config();
const { encrypt, decrypt } = require('../utils/encrypt');

// Test the encryption functions with different scenarios
console.log('=== Testing Encryption/Decryption ===\n');

// Test 1: Normal message
const testMessage = "Hello, this is a test message!";
console.log('1. Testing normal message:');
console.log('Original:', testMessage);

try {
  const encrypted = encrypt(testMessage);
  console.log('Encrypted:', encrypted);
  console.log('Contains colon:', encrypted.includes(':'));
  
  const decrypted = decrypt(encrypted);
  console.log('Decrypted:', decrypted);
  console.log('Match:', testMessage === decrypted);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n2. Testing empty string:');
try {
  const emptyEncrypted = encrypt('');
  console.log('Empty encrypted:', emptyEncrypted);
  const emptyDecrypted = decrypt(emptyEncrypted);
  console.log('Empty decrypted:', emptyDecrypted);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n3. Testing malformed encrypted data:');
try {
  const malformed = "invalidformat:novalidbase64";
  const malformedDecrypted = decrypt(malformed);
  console.log('Malformed decrypted:', malformedDecrypted);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n4. Testing plain text (no colon):');
try {
  const plainText = "This is plain text";
  const plainDecrypted = decrypt(plainText);
  console.log('Plain text decrypted:', plainDecrypted);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n5. Testing real encrypted data format:');
try {
  // Create a properly formatted encrypted string
  const message = "Test message for verification";
  const encrypted = encrypt(message);
  console.log('Real encrypted format:', encrypted);
  
  // Try to split and analyze
  const parts = encrypted.split(':');
  console.log('Parts count:', parts.length);
  if (parts.length === 2) {
    console.log('IV part length:', parts[0].length);
    console.log('Encrypted part length:', parts[1].length);
    
    // Try to decode the IV to check if it's valid base64
    try {
      const ivBuffer = Buffer.from(parts[0], 'base64');
      console.log('IV buffer length:', ivBuffer.length);
    } catch (e) {
      console.log('IV is not valid base64');
    }
  }
  
  const decrypted = decrypt(encrypted);
  console.log('Decrypted:', decrypted);
  console.log('Matches original:', message === decrypted);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n=== Test Complete ===');
