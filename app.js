const express = require("express");
const cors = require("cors"); // <-- add this
const app = express();
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/message");
const postRoutes = require("./routes/post");
const errorHandler = require("./middleware/errorHandler");

app.use(cors()); // <-- added this line for cross origin sharing
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/posts", postRoutes);
app.use(errorHandler);

module.exports = app;