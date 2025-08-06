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
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('CORS: Allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS: Blocking origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Origin', 
    'X-Requested-With', 
    'Accept',
    'Cache-Control',
    'Pragma',
    'If-None-Match',
    'If-Modified-Since',
    'Expires',
    'Last-Modified',
    'ETag'
  ],
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