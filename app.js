const express = require("express");
const cors = require("cors");
const http = require("http");
const app = express();
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/message");
const postRoutes = require("./routes/post");
const badgePaymentRoutes = require("./routes/badgePayment");
const badgePricingRoutes = require('./routes/badgePricing');
const journalPricingRoutes = require('./routes/journalPricing');
const errorHandler = require("./middleware/errorHandler");
const journalRoutes = require("./routes/journal");
const journalPaymentRoutes = require("./routes/journalPayment");
const adRoutes = require("./routes/ads");
const adminAdRoutes = require("./routes/adminAds");
const paymentRoutes = require("./routes/payments");

require('dotenv').config();
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173'
].filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200
}));
app.set('trust proxy', 1);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/badge-payments", badgePaymentRoutes);
app.use("/api/badge-pricing", badgePricingRoutes);
app.use("/api/journal-pricing", journalPricingRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/journal-payments", journalPaymentRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/admin/ads", adminAdRoutes);
app.use("/api/payments", paymentRoutes);
app.use(errorHandler);
app.all('/debug-headers', (req, res) => {
  res.json({ headers: req.headers });
});

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
const setupSocket = require("./sockets");
const io = setupSocket(server);
app.set('socketio', io); // Make socket.io instance available to controllers

// Initialize ad management services
const AdService = require('./services/adService');
if (process.env.NODE_ENV !== 'test') {
  AdService.initializeScheduledTasks();
}
// --- END SOCKET.IO SETUP ---

module.exports = { app, server };