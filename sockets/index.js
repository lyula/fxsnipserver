// Main socket.io setup and event registration
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const messagingSocket = require("./messaging");
const onlineSocket = require("./online");

module.exports = function setupSocket(server) {
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
      } catch (err) {}
    }
    if (userId) socket.userId = userId;

    // Register socket event handlers
    messagingSocket(io, socket, onlineUsers);
    onlineSocket(io, socket, onlineUsers);
  });

  return io;
};
