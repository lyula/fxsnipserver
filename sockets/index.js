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
    console.log("[Socket] New connection attempt", { socketId: socket.id, auth: socket.handshake.auth, query: socket.handshake.query });
    // Authenticate user via token (sent as query param or handshake)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        socket.userId = userId; // Ensure socket.userId is always set if valid
        onlineUsers[userId] = socket.id;
        io.emit("user-online", { userId });
        console.log(`[Socket] Authenticated and online: userId=${userId}, socketId=${socket.id}`);
      } catch (err) {
        console.warn("[Socket] Invalid token, disconnecting", { error: err.message });
        socket.disconnect(); // Disconnect if token is invalid
        return;
      }
    } else {
      console.warn("[Socket] No token provided, disconnecting", { socketId: socket.id });
      socket.disconnect(); // Disconnect if no token
      return;
    }

    // Register socket event handlers
    console.log(`[Socket] Registering event handlers for userId=${userId}, socketId=${socket.id}`);
    messagingSocket(io, socket, onlineUsers);
    onlineSocket(io, socket, onlineUsers);
  });

  return io;
};
