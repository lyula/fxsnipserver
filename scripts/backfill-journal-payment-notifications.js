// Backfill script to send notifications for all journal payments
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const JournalPayment = require('../models/JournalPayment');
const Notification = require('../models/Notification');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const payments = await JournalPayment.find({});
  let count = 0;
  for (const payment of payments) {
    // Check if notification already exists for this payment
    const existing = await Notification.findOne({ payment: payment._id, type: 'journal_payment' });
    if (existing) continue;
    const user = await User.findById(payment.userId);
    if (!user) continue;
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
    await Notification.create({
      user: payment.userId,
      type: 'journal_payment',
      message,
      read: false,
      payment: payment._id
    });
    count++;
  }
  console.log(`Backfilled ${count} journal payment notifications.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
