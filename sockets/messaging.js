// Handles real-time messaging events for socket.io
const { createMessage } = require("../controllers/messageController");

module.exports = function messagingSocket(io, socket, onlineUsers) {
  socket.on("sendMessage", async (data) => {
    try {
      if (!socket.userId) return;
      const { to, text } = data;
      if (!to || !text) return;
      // Save message to DB
      const populatedMsg = await createMessage({ from: socket.userId, to, text });
      // Emit to recipient if online
      if (onlineUsers[to]) {
        io.to(onlineUsers[to]).emit("receiveMessage", populatedMsg);
      }
      // Emit to sender (for optimistic update)
      socket.emit("receiveMessage", populatedMsg);
    } catch (err) {
      // Optionally handle error
    }
  });
};
