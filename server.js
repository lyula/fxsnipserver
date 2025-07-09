require("dotenv").config();
const { app, server } = require("./app");
const connectDB = require("./config/db");
const cron = require('node-cron');
const { expireOldBadgePayments } = require('./controllers/badgePaymentController');
const { updateUsdToKes } = require('./controllers/badgePricingController');

connectDB().then(() => {
  // Schedule badge expiry check every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await expireOldBadgePayments();
    } catch (err) {
      console.error('Badge expiry cron error:', err);
    }
  });

  // Schedule USD/KES rate update every hour
  cron.schedule('15 * * * *', async () => {
    try {
      await updateUsdToKes();
    } catch (err) {
      console.error('USD/KES cron error:', err);
    }
  });

  server.listen(process.env.PORT || 5000);
  console.log("Server running on port " + (process.env.PORT || 5000));
});
