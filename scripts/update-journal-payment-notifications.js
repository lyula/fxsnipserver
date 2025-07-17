// Script to update existing journal payment notifications to use a more professional tone
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Notification = require('../models/Notification');
const JournalPayment = require('../models/JournalPayment');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const notifications = await Notification.find({ type: 'journal_payment' });
  let count = 0;
  for (const notif of notifications) {
    // Find the related payment and user
    const payment = await JournalPayment.findById(notif.payment);
    const user = payment ? await User.findById(payment.userId) : null;
    if (!payment || !user) continue;
    const reason = payment.journalType === 'screenrecording'
      ? 'Unlimited Journals + Screen Recordings'
      : payment.journalType === 'unlimited'
      ? 'Unlimited Journals (No Screen Recordings)'
      : 'journal subscription';
    let message;
    if (payment.status === 'success') {
      message = `Dear ${user.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was successful. Thank you for your subscription.`;
    } else if (payment.status === 'failed') {
      message = `Dear ${user.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was not successful. Reason: ${payment.failureReason || 'Unknown error'}. Please try again or contact support if the issue persists.`;
    } else {
      message = `Dear ${user.username}, your payment for ${reason} is currently pending. We will notify you once the status is updated.`;
    }
    notif.message = message;
    await notif.save();
    count++;
  }
  console.log(`Updated ${count} journal payment notifications.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
