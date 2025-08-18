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

    // Push notification logic
    try {
      const User = require('../models/User');
      const NotificationPreferences = require('../models/NotificationPreferences');
      const { sendExpoPushNotification } = require('./expoPush');
      const recipient = await User.findById(to);
      if (recipient?.expoPushToken) {
        const prefs = await NotificationPreferences.findOne({ user: recipient._id });
        if (prefs?.push && prefs?.pushTypes?.message !== false) {
          // Get sender username
          const sender = await User.findById(from).select('username');
          await sendExpoPushNotification(
            recipient.expoPushToken,
            'New Message',
            `${sender?.username || 'Someone'} sent you a message.`,
            { messageId: msg._id, from: from }
          );
        }
      }
    } catch (err) {
      console.error('Error sending message push notification:', err);
    }

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
