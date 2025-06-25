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
    const myId = new mongoose.Types.ObjectId(req.user.id || req.user._id);
    console.log("Fetching conversations for user:", myId);

    // Assuming you use Mongoose and populate the user field:
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate({
        path: "user",
        select: "username countryFlag verified", // <-- Make sure 'verified' is included
      })
      .populate("lastMessage")
      .lean();

    console.log("Aggregation result:", conversations);

    const results = await Promise.all(conversations.map(async conv => {
      try {
        const user = await User.findById(conv._id).select("_id username countryFlag verified"); // <-- 'verified' added here
        const unreadCount = await Message.countDocuments({
          from: conv._id,
          to: myId,
          read: { $ne: true }
        });
        return {
          user,
          lastMessage: conv.lastMessage,
          unreadCount
        };
      } catch (innerErr) {
        console.error("Error fetching user or unread count for conversation:", conv, innerErr);
        return null;
      }
    }));

    const filteredResults = results.filter(r => r && r.user);

    console.log("Final conversation results:", filteredResults);

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