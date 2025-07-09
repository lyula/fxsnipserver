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
const errorHandler = require("./middleware/errorHandler");

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://fxsnip.vercel.app'
  ],
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
app.use(errorHandler);
app.all('/debug-headers', (req, res) => {
  res.json({ headers: req.headers });
});

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
const setupSocket = require("./sockets");
setupSocket(server);
// --- END SOCKET.IO SETUP ---

module.exports = { app, server };