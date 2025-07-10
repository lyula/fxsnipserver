// Handles online status and last seen events for socket.io
const User = require("../models/User");

module.exports = function onlineSocket(io, socket, onlineUsers) {
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
