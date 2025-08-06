require('dotenv').config();
const { encrypt, decrypt } = require('../utils/encrypt');

console.log('Testing encryption/decryption...');

// Test with a simple message
const originalMessage = "Hello, this is a test message!";
console.log('Original message:', originalMessage);

try {
  // Test encryption
  const encrypted = encrypt(originalMessage);
  console.log('Encrypted message:', encrypted);
  
  // Test decryption
  const decrypted = decrypt(encrypted);
  console.log('Decrypted message:', decrypted);
  
  // Check if they match
  if (originalMessage === decrypted) {
    console.log('✅ Encryption/decryption working correctly!');
  } else {
    console.log('❌ Encryption/decryption failed - messages don\'t match');
  }
  
  // Test with empty string
  const emptyEncrypted = encrypt('');
  const emptyDecrypted = decrypt(emptyEncrypted);
  console.log('Empty string test:', { encrypted: emptyEncrypted, decrypted: emptyDecrypted });
  
  // Test with plain text (no colon)
  const plainText = "This is plain text";
  const plainDecrypted = decrypt(plainText);
  console.log('Plain text test:', { original: plainText, decrypted: plainDecrypted });
  
  // Test with malformed encrypted text
  const malformed = "invalid:encryption:format";
  const malformedDecrypted = decrypt(malformed);
  console.log('Malformed test:', { original: malformed, decrypted: malformedDecrypted });
  
} catch (error) {
  console.error('Error during testing:', error);
}

console.log('Test completed.');
