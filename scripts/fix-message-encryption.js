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

async function fixMessageEncryption() {
  try {
    console.log('Starting message encryption fix...');
    
    // Get all messages
    const messages = await Message.find({}).lean();
    console.log(`Found ${messages.length} messages to check`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const message of messages) {
      if (!message.text) continue;
      
      try {
        // Try to decrypt the message
        const decrypted = decrypt(message.text);
        
        // If decryption was successful and the result is not "[decryption error]"
        if (decrypted && decrypted !== '[decryption error]') {
          console.log(`Message ${message._id}: Successfully decrypted`);
          continue; // Message is properly encrypted, skip
        }
        
        // If we get here, the message might be plain text or corrupted
        // Check if it looks like plain text (no encryption format)
        if (!message.text.includes(':')) {
          // This looks like plain text, re-encrypt it
          const encrypted = encrypt(message.text);
          await Message.updateOne(
            { _id: message._id },
            { $set: { text: encrypted } }
          );
          console.log(`Message ${message._id}: Re-encrypted plain text`);
          fixedCount++;
        } else {
          // This looks like corrupted encryption, mark as error
          console.log(`Message ${message._id}: Corrupted encryption detected`);
          errorCount++;
        }
        
      } catch (error) {
        // If decryption fails completely, check if it's plain text
        if (!message.text.includes(':')) {
          // This is plain text, encrypt it
          try {
            const encrypted = encrypt(message.text);
            await Message.updateOne(
              { _id: message._id },
              { $set: { text: encrypted } }
            );
            console.log(`Message ${message._id}: Encrypted plain text (after decrypt error)`);
            fixedCount++;
          } catch (encryptError) {
            console.error(`Message ${message._id}: Failed to encrypt:`, encryptError);
            errorCount++;
          }
        } else {
          console.error(`Message ${message._id}: Decryption failed:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log(`\nEncryption fix completed:`);
    console.log(`- Total messages: ${messages.length}`);
    console.log(`- Fixed messages: ${fixedCount}`);
    console.log(`- Error messages: ${errorCount}`);
    console.log(`- Already encrypted: ${messages.length - fixedCount - errorCount}`);
    
  } catch (error) {
    console.error('Error fixing message encryption:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
async function main() {
  await connectDB();
  await fixMessageEncryption();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixMessageEncryption };
