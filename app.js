const express = require("express");
const cors = require("cors");
const app = express();
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/message");
const postRoutes = require("./routes/post");
const badgePaymentRoutes = require("./routes/badgePayment");
const errorHandler = require("./middleware/errorHandler");

app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-production-frontend.com'
  ],
  credentials: true,
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/badge-payments", badgePaymentRoutes);
app.use(errorHandler);
app.all('/debug-headers', (req, res) => {
  res.json({ headers: req.headers });
});

module.exports = app;