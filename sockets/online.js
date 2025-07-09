// Handles online status, typing, and last seen events for socket.io
const User = require("../models/User");

module.exports = function onlineSocket(io, socket, onlineUsers) {
  // Typing event
  socket.on("typing", (data) => {
    if (data?.toUserId && onlineUsers[data.toUserId]) {
      io.to(onlineUsers[data.toUserId]).emit("typing", { fromUserId: socket.userId });
    }
  });

  // Stop typing event
  socket.on("stop-typing", (data) => {
    if (data?.toUserId && onlineUsers[data.toUserId]) {
      io.to(onlineUsers[data.toUserId]).emit("stop-typing", { fromUserId: socket.userId });
    }
  });

  // Disconnect event
  socket.on("disconnect", async () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      io.emit("user-offline", { userId: socket.userId });
      await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
    }
  });
};
