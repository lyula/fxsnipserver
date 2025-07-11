// Shared message creation logic for both REST and socket
const Message = require("../models/Message");
const { encrypt, decrypt } = require("./encrypt");

/**
 * Creates a message, encrypts the text, and returns the message with decrypted text for the client.
 * @param {Object} param0 - { from, to, text, replyTo, mediaUrl, mediaPublicId }
 * @returns {Promise<Object>} - The message object with decrypted text
 */
async function createMessage({ from, to, text, replyTo, mediaUrl, mediaPublicId }) {
  const encryptedText = text ? encrypt(text) : undefined;
  const msg = await Message.create({
    from,
    to,
    text: encryptedText || '',
    replyTo,
    mediaUrl: mediaUrl || null,
    mediaPublicId: mediaPublicId || null
  });
  const msgObj = msg.toObject();
  msgObj.text = text || '';
  return msgObj;
}

module.exports = { createMessage };
