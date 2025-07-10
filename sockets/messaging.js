// Handles real-time messaging events for socket.io
const { createMessage } = require("../utils/message");

// Helper to generate a unique conversationId for 1:1 chats
function getConversationId(userId1, userId2) {
  // Sort IDs to ensure the same ID for both directions
  return [userId1, userId2].sort().join(":");
}

module.exports = function messagingSocket(io, socket, onlineUsers) {
  socket.on("sendMessage", async (data) => {
    console.log("[Socket] sendMessage event received", { userId: socket.userId, data });
    try {
      if (!socket.userId) {
        console.warn("[Socket] sendMessage: No userId on socket");
        return;
      }
      const { to, text, replyTo } = data;
      if (!to || !text) {
        console.warn("[Socket] sendMessage: Missing 'to' or 'text'", { to, text });
        return;
      }
      // Generate conversationId
      const conversationId = getConversationId(socket.userId, to);
      // Save message to DB using shared logic
      const populatedMsg = await createMessage({ from: socket.userId, to, text, replyTo });
      console.log("[Socket] Message created and will be emitted", { from: socket.userId, to, text, msgId: populatedMsg && populatedMsg._id });
      // Emit to recipient if online (support multiple sockets)
      if (onlineUsers[to]) {
        const socketIds = Array.isArray(onlineUsers[to]) ? onlineUsers[to] : [onlineUsers[to]];
        socketIds.forEach(socketId => {
          io.to(socketId).emit("receiveMessage", { ...populatedMsg, conversationId });
        });
        console.log(`[Socket] Message emitted to recipient online: ${to} (socketIds: ${socketIds})`);
      } else {
        console.log(`[Socket] Recipient offline: ${to}`);
      }
      // Emit to sender (for optimistic update)
      socket.emit("receiveMessage", { ...populatedMsg, conversationId });
      console.log(`[Socket] Message emitted to sender: ${socket.userId}`);
    } catch (err) {
      console.error("[Socket] Error in sendMessage:", err);
    }
  });

  // --- Handle seen receipts ---
  socket.on("seen", async (data) => {
    try {
      let { conversationId, messageIds, to } = data;
      if (!conversationId && to) {
        conversationId = getConversationId(socket.userId, to);
      }
      if (!socket.userId || !conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      // Update messages as read in DB
      const Message = require("../models/Message");
      await Message.updateMany(
        { _id: { $in: messageIds }, to: socket.userId, read: { $ne: true } },
        { $set: { read: true } }
      );
      // Emit to the other user (sender) that these messages were seen
      if (onlineUsers[to]) {
        const socketIds = Array.isArray(onlineUsers[to]) ? onlineUsers[to] : [onlineUsers[to]];
        socketIds.forEach(socketId => {
          io.to(socketId).emit("messagesSeen", { conversationId, messageIds });
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
    console.log('[Socket] typing event RAW data:', data, 'socket.userId:', socket.userId);
    let { to, conversationId } = data || {};
    if (!conversationId && to) {
      conversationId = getConversationId(socket.userId, to);
    }
    if (!socket.userId || !to || !conversationId) {
      console.warn('[Socket] typing event missing required fields', { userId: socket.userId, to, conversationId, data });
      return;
    }
    // Defensive: always treat onlineUsers[to] as an array
    let socketIds = [];
    if (Array.isArray(onlineUsers[to])) {
      socketIds = onlineUsers[to];
    } else if (onlineUsers[to]) {
      socketIds = [onlineUsers[to]];
    }
    console.log('[Socket] typing event received:', { from: socket.userId, to, conversationId, onlineUsersEntry: onlineUsers[to], socketIds });
    if (socketIds.length === 0) {
      console.warn('[Socket] No recipient sockets found for typing event', { to, onlineUsers });
    }
    socketIds.forEach(socketId => {
      io.to(socketId).emit("typing", { conversationId, userId: socket.userId });
      console.log('[Socket] typing event emitted to:', { socketId, conversationId, userId: socket.userId });
    });
    // Extra debug: print all onlineUsers mapping
    console.log('[Socket] FULL onlineUsers mapping:', JSON.stringify(onlineUsers, null, 2));
  });

  // --- Handle stop-typing status ---
  socket.on("stop-typing", (data) => {
    console.log('[Socket] stop-typing event RAW data:', data, 'socket.userId:', socket.userId);
    let { to, conversationId } = data || {};
    if (!conversationId && to) {
      conversationId = getConversationId(socket.userId, to);
    }
    if (!socket.userId || !to || !conversationId) {
      console.warn('[Socket] stop-typing event missing required fields', { userId: socket.userId, to: to, conversationId: conversationId, data: data });
      return;
    }
    const socketIds = Array.isArray(onlineUsers[to]) ? onlineUsers[to] : onlineUsers[to] ? [onlineUsers[to]] : [];
    console.log('[Socket] stop-typing event received:', { from: socket.userId, to, conversationId, socketIds });
    socketIds.forEach(socketId => {
      io.to(socketId).emit("stop-typing", { conversationId, userId: socket.userId });
      console.log('[Socket] stop-typing event emitted to:', { socketId, conversationId, userId: socket.userId });
    });
  });
};
