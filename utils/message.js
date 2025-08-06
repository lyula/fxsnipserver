// Shared message creation logic for both REST and socket
const Message = require("../models/Message");
const { encrypt, decrypt } = require("./encrypt");

/**
 * Creates a message, encrypts the text, and returns the message with decrypted text for the client.
 * @param {Object} param0 - { from, to, text, replyTo, mediaUrl, mediaPublicId }
 * @returns {Promise<Object>} - The message object with decrypted text
 */
async function createMessage({ from, to, text, replyTo, mediaUrl, mediaPublicId }) {
  try {
    const encryptedText = text ? encrypt(text) : '';
    const msg = await Message.create({
      from,
      to,
      text: encryptedText,
      replyTo,
      mediaUrl: mediaUrl || null,
      mediaPublicId: mediaPublicId || null
    });
    
    const msgObj = msg.toObject();
    // Return the original text (not encrypted) for immediate display
    msgObj.text = text || '';
    return msgObj;
  } catch (error) {
    console.error('Error creating message:', error);
    throw error;
  }
}

module.exports = { createMessage };
