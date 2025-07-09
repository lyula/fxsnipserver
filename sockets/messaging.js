// Handles real-time messaging events for socket.io
const { createMessage } = require("../utils/message");

module.exports = function messagingSocket(io, socket, onlineUsers) {
  socket.on("sendMessage", async (data) => {
    console.log("[Socket] sendMessage event received", { userId: socket.userId, data });
    try {
      if (!socket.userId) {
        console.warn("[Socket] sendMessage: No userId on socket");
        return;
      }
      const { to, text } = data;
      if (!to || !text) {
        console.warn("[Socket] sendMessage: Missing 'to' or 'text'", { to, text });
        return;
      }
      // Save message to DB using shared logic
      const populatedMsg = await createMessage({ from: socket.userId, to, text });
      console.log("[Socket] Message created and will be emitted", { from: socket.userId, to, text, msgId: populatedMsg && populatedMsg._id });
      // Emit to recipient if online
      if (onlineUsers[to]) {
        io.to(onlineUsers[to]).emit("receiveMessage", populatedMsg);
        console.log(`[Socket] Message emitted to recipient online: ${to} (socketId: ${onlineUsers[to]})`);
      } else {
        console.log(`[Socket] Recipient offline: ${to}`);
      }
      // Emit to sender (for optimistic update)
      socket.emit("receiveMessage", populatedMsg);
      console.log(`[Socket] Message emitted to sender: ${socket.userId}`);
    } catch (err) {
      console.error("[Socket] Error in sendMessage:", err);
    }
  });
};
