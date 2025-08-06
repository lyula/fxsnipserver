require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forex-journal');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function inspectMessages() {
  try {
    console.log('Inspecting messages in database...');
    
    // Get first 5 messages to inspect their format
    const messages = await Message.find({}).limit(5).lean();
    console.log(`Found ${messages.length} messages to inspect`);
    
    messages.forEach((message, index) => {
      console.log(`\nMessage ${index + 1}:`);
      console.log(`- ID: ${message._id}`);
      console.log(`- From: ${message.from}`);
      console.log(`- To: ${message.to}`);
      console.log(`- Text: "${message.text}"`);
      console.log(`- Text length: ${message.text ? message.text.length : 0}`);
      console.log(`- Contains colon: ${message.text ? message.text.includes(':') : false}`);
      console.log(`- Created: ${message.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error inspecting messages:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

async function main() {
  await connectDB();
  await inspectMessages();
}

main().catch(console.error);
