// Basic socket.io server for online status, typing, and last seen
const http = require("http");
const app = require("./app");
const User = require("./models/User");
const jwt = require("jsonwebtoken");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});

// Store online users: { userId: socketId }
const onlineUsers = {};

io.on("connection", (socket) => {
  // Authenticate user via token (sent as query param or handshake)
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  let userId = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      onlineUsers[userId] = socket.id;
      io.emit("user-online", { userId });
    } catch (err) {
      // Invalid token
    }
  }

  // Typing event
  socket.on("typing", (data) => {
    // data: { toUserId }
    if (data?.toUserId && onlineUsers[data.toUserId]) {
      io.to(onlineUsers[data.toUserId]).emit("typing", { fromUserId: userId });
    }
  });

  // Stop typing event
  socket.on("stop-typing", (data) => {
    if (data?.toUserId && onlineUsers[data.toUserId]) {
      io.to(onlineUsers[data.toUserId]).emit("stop-typing", { fromUserId: userId });
    }
  });

  socket.on("disconnect", async () => {
    if (userId) {
      delete onlineUsers[userId];
      io.emit("user-offline", { userId });
      // Update lastSeen
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    }
  });
});

module.exports = { server, io };
