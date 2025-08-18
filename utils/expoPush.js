const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo
 * @param {string} expoPushToken - Expo push token for the device
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} [data] - Optional data payload
 * @returns {Promise<object>} - Expo API response
 */
async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    throw new Error('Invalid Expo push token');
  }
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };
  try {
    const response = await axios.post(EXPO_PUSH_URL, message);
    return response.data;
  } catch (error) {
    console.error('Expo push notification error:', error?.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendExpoPushNotification };
