const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encrypt");

// Send a message
router.post("/", requireAuth, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ message: "Recipient and text required." });
  // Encrypt the message text before saving
  const encryptedText = encrypt(text);
  const msg = await Message.create({ from: req.user.id, to, text: encryptedText });
  // Decrypt before sending to client
  const msgObj = msg.toObject();
  msgObj.text = text;
  res.json(msgObj);
});

// Get all conversations for the logged-in user, with unread counts
router.get("/", requireAuth, async (req, res) => {
  try {
    const myId = new mongoose.Types.ObjectId(req.user.id);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ from: myId }, { to: myId }]
        }
      },
      {
        $sort: { createdAt: 1 } // Sort messages chronologically first
      },
      {
        $addFields: {
          otherUser: {
            $cond: [
              { $eq: ["$from", myId] },
              "$to",
              "$from"
            ]
          }
        }
      },
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $last: "$$ROOT" }, // Now this will be the actual last message
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$to", myId] },
                    { $ne: ["$read", true] }
                  ]
                },
                1,
                0
              ]
            }
          },
          // Add total message count for debugging
          totalMessages: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
          pipeline: [
            { $project: { username: 1, countryFlag: 1, verified: 1 } }
          ]
        }
      },
      {
        $unwind: "$user"
      },
      {
        $sort: { "lastMessage.createdAt": -1 } // Sort conversations by last message time
      }
    ]);

    // Debug log to check the data structure
    console.log("Conversations fetched:", conversations.length);
    if (conversations.length > 0) {
      console.log("Sample conversation:", {
        user: conversations[0].user.username,
        lastMessageText: conversations[0].lastMessage?.text,
        lastMessageFrom: conversations[0].lastMessage?.from,
        lastMessageTo: conversations[0].lastMessage?.to,
        createdAt: conversations[0].lastMessage?.createdAt,
        totalMessages: conversations[0].totalMessages
      });
    }

    // Decrypt all message texts before sending
    conversations.forEach(msg => {
      if (msg.text) {
        try { msg.text = decrypt(msg.text); } catch (e) { msg.text = "[decryption error]"; }
      }
    });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: "Error fetching conversations", error: err.message });
  }
});

// Get all messages between logged-in user and another user, and mark as read
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id || req.user._id;
    const otherId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    // Mark all messages from otherId to me as read
    await Message.updateMany(
      { from: otherId, to: myId, read: { $ne: true } },
      { $set: { read: true } }
    );

    // Fetch messages with pagination and lean queries
    const messages = await Message.find({
      $or: [
        { from: myId, to: otherId },
        { from: otherId, to: myId }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();

    // Reverse to show oldest first (since we sorted by newest first for pagination)
    messages.reverse();
    
    // Decrypt messages before sending
    messages.forEach(msg => {
      if (msg.text) {
        try { msg.text = decrypt(msg.text); } catch (e) { msg.text = "[decryption error]"; }
      }
    });

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
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

// Get total unread conversation count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id || req.user._id;
    
    // Count conversations with unread messages
    const unreadConversations = await Message.aggregate([
      {
        $match: {
          to: new mongoose.Types.ObjectId(myId),
          read: { $ne: true }
        }
      },
      {
        $group: {
          _id: "$from",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({ count: unreadConversations.length });
  } catch (err) {
    console.error("Error getting unread conversation count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;