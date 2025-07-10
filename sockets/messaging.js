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
      // Emit to recipient if online (support multiple sockets)
      if (onlineUsers[to]) {
        const socketIds = Array.isArray(onlineUsers[to]) ? onlineUsers[to] : [onlineUsers[to]];
        socketIds.forEach(socketId => {
          io.to(socketId).emit("receiveMessage", populatedMsg);
        });
        console.log(`[Socket] Message emitted to recipient online: ${to} (socketIds: ${socketIds})`);
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

  // --- Handle seen receipts ---
  socket.on("seen", async (data) => {
    try {
      const { conversationId, messageIds } = data;
      if (!socket.userId || !conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      // Update messages as read in DB
      const Message = require("../models/Message");
      await Message.updateMany(
        { _id: { $in: messageIds }, to: socket.userId, read: { $ne: true } },
        { $set: { read: true } }
      );
      // Emit to the other user (sender) that these messages were seen
      if (onlineUsers[conversationId]) {
        const socketIds = Array.isArray(onlineUsers[conversationId]) ? onlineUsers[conversationId] : [onlineUsers[conversationId]];
        socketIds.forEach(socketId => {
          io.to(socketId).emit("messagesSeen", { conversationId: socket.userId, messageIds });
        });
      }
      // Optionally, emit to self for instant UI update
      socket.emit("messagesSeen", { conversationId, messageIds });
      console.log(`[Socket] Seen receipts processed for convId=${conversationId}, messageIds=${messageIds}`);
    } catch (err) {
      console.error("[Socket] Error in seen handler:", err);
    }
  });

  // --- Handle typing status ---
  socket.on("typing", (data) => {
    const { to, conversationId } = data;
    if (!socket.userId || !to || !conversationId) return;
    // Emit to recipient if online
    if (onlineUsers[to]) {
      const socketIds = Array.isArray(onlineUsers[to]) ? onlineUsers[to] : [onlineUsers[to]];
      socketIds.forEach(socketId => {
        io.to(socketId).emit("typing", { from: socket.userId, conversationId });
      });
    }
  });
};
