require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { encrypt, decrypt } = require('../utils/encrypt');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forex-journal');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixAllMessages() {
  try {
    console.log('Starting to fix all messages...');
    
    // Get all messages
    const messages = await Message.find({});
    console.log(`Found ${messages.length} messages to process`);
    
    let fixedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;
    
    for (const message of messages) {
      if (!message.text) {
        console.log(`Message ${message._id}: Empty text, skipping`);
        continue;
      }
      
      try {
        // Try to decrypt the message to see if it's already properly encrypted
        const decrypted = decrypt(message.text);
        
        // If it contains colon and decrypts successfully (not returning error), it's properly encrypted
        if (message.text.includes(':') && decrypted !== '[decryption error]') {
          console.log(`Message ${message._id}: Already properly encrypted`);
          alreadyEncryptedCount++;
          continue;
        }
        
        // If it doesn't contain colon or failed to decrypt, treat as plain text and re-encrypt
        let textToEncrypt = message.text;
        
        // If it failed decryption but has colon, it might be corrupted - use the text as is
        if (message.text.includes(':') && decrypted === '[decryption error]') {
          console.log(`Message ${message._id}: Corrupted encryption detected, treating as plain text`);
          // For corrupted data, we'll just use the text as is (might be garbled, but better than losing it)
        } else if (!message.text.includes(':')) {
          console.log(`Message ${message._id}: Plain text detected`);
        }
        
        // Re-encrypt the message
        const encrypted = encrypt(textToEncrypt);
        
        if (encrypted && encrypted.includes(':')) {
          await Message.updateOne(
            { _id: message._id },
            { $set: { text: encrypted } }
          );
          console.log(`Message ${message._id}: Successfully re-encrypted`);
          fixedCount++;
        } else {
          console.error(`Message ${message._id}: Failed to encrypt - encryption returned: ${encrypted}`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`Message ${message._id}: Error processing:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n=== Fix Results ===`);
    console.log(`Total messages: ${messages.length}`);
    console.log(`Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error fixing messages:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
async function main() {
  await connectDB();
  await fixAllMessages();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixAllMessages };
