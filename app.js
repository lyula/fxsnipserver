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
  origin: ["http://localhost:5173", "https://fxsnip.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // add this line
  optionsSuccessStatus: 200 // add this for legacy browser support
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