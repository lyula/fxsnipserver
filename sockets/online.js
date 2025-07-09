// Handles online status, typing, and last seen events for socket.io
const User = require("../models/User");

module.exports = function onlineSocket(io, socket, onlineUsers) {
  // Typing event
  socket.on("typing", (data) => {
    if (data?.toUserId && onlineUsers[data.toUserId] && onlineUsers[data.toUserId].length > 0) {
      onlineUsers[data.toUserId].forEach(socketId => {
        io.to(socketId).emit("typing", { fromUserId: socket.userId });
      });
    }
  });

  // Stop typing event
  socket.on("stop-typing", (data) => {
    if (data?.toUserId && onlineUsers[data.toUserId] && onlineUsers[data.toUserId].length > 0) {
      onlineUsers[data.toUserId].forEach(socketId => {
        io.to(socketId).emit("stop-typing", { fromUserId: socket.userId });
      });
    }
  });

  // Send current online users to the requesting client
  socket.on("get-online-users", () => {
    const onlineUserIds = Object.keys(onlineUsers).filter(userId => onlineUsers[userId] && onlineUsers[userId].length > 0);
    socket.emit("online-users-list", { userIds: onlineUserIds });
  });

  // Disconnect event
  socket.on("disconnect", async () => {
    if (socket.userId && onlineUsers[socket.userId]) {
      onlineUsers[socket.userId] = onlineUsers[socket.userId].filter(id => id !== socket.id);
      if (onlineUsers[socket.userId].length === 0) {
        delete onlineUsers[socket.userId];
        io.emit("user-offline", { userId: socket.userId });
        await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
      }
    }
  });
};
