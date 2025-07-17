// Script to update existing badge payment notifications to use a more professional tone
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Notification = require('../models/Notification');
const BadgePayment = require('../models/BadgePayment');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const notifications = await Notification.find({ type: 'badge_payment' });
  let count = 0;
  for (const notif of notifications) {
    // Find the related payment and user
    const payment = await BadgePayment.findById(notif.payment);
    const user = payment ? await User.findById(payment.user) : null;
    if (!payment || !user) continue;
    const reason = payment.type === 'verified_badge'
      ? 'Blue Badge subscription'
      : payment.type
        ? `${payment.type.charAt(0).toUpperCase() + payment.type.slice(1)} badge subscription`
        : 'badge subscription';
    let message;
    // Accept both 'success' and 'completed' as success, and 'failed' as failure
    if (['success', 'completed'].includes(payment.status)) {
      message = `Dear ${user.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was successful. Thank you for your subscription.`;
    } else if (payment.status === 'failed') {
      // Try to get the most informative failure reason
      let failureReason = null;
      if (payment.rawResponse && (payment.rawResponse.ResultDesc || payment.rawResponse.resultDesc)) {
        failureReason = payment.rawResponse.ResultDesc || payment.rawResponse.resultDesc;
      } else if (payment.methodDetails && (payment.methodDetails.ResultDesc || payment.methodDetails.resultDesc)) {
        failureReason = payment.methodDetails.ResultDesc || payment.methodDetails.resultDesc;
      } else if (payment.failureReason) {
        failureReason = payment.failureReason;
      }
      message = `Dear ${user.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was not successful. Reason: ${failureReason || 'Unknown error'}. Please try again or contact support if the issue persists.`;
    } else {
      message = `Dear ${user.username}, your payment for ${reason} is currently pending. We will notify you once the status is updated.`;
    }
    notif.message = message;
    await notif.save();
    count++;
  }
  console.log(`Updated ${count} badge payment notifications.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
