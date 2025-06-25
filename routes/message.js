const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");

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
    // Find all users you've had conversations with
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: myId },
            { to: myId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$from", myId] },
              "$to",
              "$from"
            ]
          },
          lastMessage: { $first: "$$ROOT" }
        }
      }
    ]);

    // For each conversation, count unread messages
    const results = await Promise.all(conversations.map(async conv => {
      const user = await User.findById(conv._id).select("_id username countryFlag");
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
    }));

    res.json(results);
  } catch (err) {
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

module.exports = router;