const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");

// Send a message
router.post("/", requireAuth, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ message: "Recipient and text required." });
  const msg = await Message.create({ from: req.user.id, to, text });
  res.json(msg);
});

// Get all conversations for the logged-in user, with unread counts
router.get("/", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id || req.user._id;

    // Find all users you've messaged or who have messaged you
    const sent = await Message.find({ from: myId }).distinct("to");
    const received = await Message.find({ to: myId }).distinct("from");
    const userIds = Array.from(new Set([...sent, ...received])).filter(
      id => id.toString() !== myId.toString()
    );

    // For each user, get user info, last message, and unread count
    const results = await Promise.all(userIds.map(async (userId) => {
      const user = await User.findById(userId).select("_id username countryFlag verified");
      if (!user) return null;

      const lastMessage = await Message.findOne({
        $or: [
          { from: myId, to: userId },
          { from: userId, to: myId }
        ]
      })
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await Message.countDocuments({
        from: userId,
        to: myId,
        read: { $ne: true }
      });

      return {
        user,
        lastMessage,
        unreadCount
      };
    }));

    // Filter out any nulls (in case a user was deleted)
    const filteredResults = results.filter(r => r && r.user);

    res.json(filteredResults);
  } catch (err) {
    console.error("Error in /api/message GET:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all messages between logged-in user and another user, and mark as read
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id || req.user._id;
    const otherId = req.params.userId;
    // Mark all messages from otherId to me as read
    await Message.updateMany(
      { from: otherId, to: myId, read: { $ne: true } },
      { $set: { read: true } }
    );
    // Fetch all messages
    const messages = await Message.find({
      $or: [
        { from: myId, to: otherId },
        { from: otherId, to: myId }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Additional route to fetch user details by IDs
router.post("/users", requireAuth, async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !userIds.length) return res.status(400).json({ message: "No user IDs provided." });

    // Fetch users
    const users = await User.find({ _id: { $in: userIds } })
      .select("username countryFlag verified"); // <-- Add verified here

    res.json(users);
  } catch (err) {
    console.error("Error in /api/message/users POST:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;