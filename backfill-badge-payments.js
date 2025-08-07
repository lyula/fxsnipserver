// backfill-badge-payments.js
// This script updates all users with an active badge payment (periodEnd in the future)
// to set their verified status to true and update all their previous completed badge payments
// to have the latest periodStart and periodEnd.

const mongoose = require('mongoose');
const User = require('./models/User');
const BadgePayment = require('./models/BadgePayment');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function backfillBadgePayments() {
  await mongoose.connect(MONGO_URI);

  // Find all users with at least one active completed badge payment
  const activePayments = await BadgePayment.aggregate([
    { $match: {
        type: 'verified_badge',
        status: 'completed',
        periodEnd: { $gt: new Date() }
      }
    },
    { $group: {
        _id: '$user',
        latestPeriodStart: { $max: '$periodStart' },
        latestPeriodEnd: { $max: '$periodEnd' }
      }
    }
  ]);

  for (const paymentGroup of activePayments) {
    const userId = paymentGroup._id;
    const latestPeriodStart = paymentGroup.latestPeriodStart;
    const latestPeriodEnd = paymentGroup.latestPeriodEnd;

    // Update all completed badge payments for this user
    await BadgePayment.updateMany(
      {
        user: userId,
        type: 'verified_badge',
        status: 'completed'
      },
      {
        periodStart: latestPeriodStart,
        periodEnd: latestPeriodEnd
      }
    );

    // Set user as verified
    await User.findByIdAndUpdate(userId, { verified: true });
    console.log(`Updated user ${userId} and their badge payments.`);
  }

  await mongoose.disconnect();
  console.log('Backfill complete.');
}

backfillBadgePayments().catch(console.error);
