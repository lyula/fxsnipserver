const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

// Send a message
router.post("/", requireAuth, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ message: "Recipient and text required." });
  const msg = await Message.create({ from: req.user.id, to, text });
  res.json(msg);
});

// Get conversation between two users
router.get("/:userId", requireAuth, async (req, res) => {
  const otherUserId = req.params.userId;
  const myId = req.user.id;
  const messages = await Message.find({
    $or: [
      { from: myId, to: otherUserId },
      { from: otherUserId, to: myId }
    ]
  }).sort({ createdAt: 1 });
  res.json(messages);
});

// Get all conversations for the logged-in user (last message per user)
router.get("/", requireAuth, async (req, res) => {
  const myId = req.user.id;
  // Find all users you've chatted with
  const messages = await Message.find({
    $or: [{ from: myId }, { to: myId }]
  }).sort({ createdAt: -1 });

  // Group by user
  const conversations = {};
  messages.forEach(msg => {
    const otherUser = msg.from.toString() === myId ? msg.to.toString() : msg.from.toString();
    if (!conversations[otherUser]) conversations[otherUser] = msg;
  });

  // Fetch user info
  const userIds = Object.keys(conversations);
  const users = await User.find({ _id: { $in: userIds } }).select("username countryFlag");
  const result = users.map(u => ({
    user: u,
    lastMessage: conversations[u._id]
  }));

  res.json(result);
});

module.exports = router;