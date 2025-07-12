const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encrypt");
const { createMessage } = require("../utils/message");

// Send a message
router.post("/", requireAuth, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ message: "Recipient and text required." });
  try {
    const msgObj = await createMessage({ from: req.user.id, to, text });
    res.json(msgObj);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message.", error: err.message });
  }
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
            { $project: { username: 1, countryFlag: 1, verified: 1, "profile.profileImage": 1 } }
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
        try {
          msg.text = decrypt(msg.text);
        } catch (e) {
          // Fallback: if decryption fails, assume it's plain text
          msg.text = msg.text;
        }
      }
    });

    // Decrypt last message text in each conversation before sending
    conversations.forEach(msg => {
      if (msg.lastMessage && msg.lastMessage.text) {
        if (msg.lastMessage.text.includes(':')) {
          try {
            msg.lastMessage.text = decrypt(msg.lastMessage.text);
          } catch (e) {
            msg.lastMessage.text = '[decryption error]';
          }
        }
        // else leave as is (plain text)
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
    // --- Weekly pagination support ---
    const before = req.query.before ? new Date(Number(req.query.before)) : null;
    const week = req.query.week ? parseInt(req.query.week) : 0; // 0 = current week, 1 = previous, etc.
    let startDate, endDate;
    if (before || week) {
      // Calculate the week range
      let refDate = before ? new Date(before) : new Date();
      // Always set to start of day for consistency
      refDate.setHours(0, 0, 0, 0);
      // Go back 'week' weeks
      refDate.setDate(refDate.getDate() - 7 * week);
      // Find the start of the week (Monday)
      const day = refDate.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // Sunday=0, Monday=1
      startDate = new Date(refDate);
      startDate.setDate(refDate.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      endDate.setHours(0, 0, 0, 0);
    }

    // Mark all messages from otherId to me as read
    await Message.updateMany(
      { from: otherId, to: myId, read: { $ne: true } },
      { $set: { read: true } }
    );

    // Build query
    const query = {
      $or: [
        { from: myId, to: otherId },
        { from: otherId, to: myId }
      ]
    };
    if (startDate && endDate) {
      query.createdAt = { $gte: startDate, $lt: endDate };
    }

    // Fetch messages (no skip/limit for week mode)
    let messages = await Message.find(query)
      .sort({ createdAt: 1 }) // oldest first for chat
      .lean()
      .exec();

    // If not using week mode, fallback to old pagination
    if (!startDate || !endDate) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const skip = (page - 1) * limit;
      messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();
      messages.reverse();
    }

    // Decrypt messages before sending
    messages.forEach(msg => {
      if (msg.text) {
        if (msg.text && msg.text.includes(':')) {
          try {
            msg.text = decrypt(msg.text);
          } catch (e) {
            msg.text = '[decryption error]';
          }
        }
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