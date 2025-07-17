const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // recipient
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // actor
    type: {
      type: String,
      enum: [
        "like_post",
        "like_comment",
        "like_reply",
        "comment",
        "reply",
        "follow",
        "mention",
        "badge_payment",
        "journal_payment", // Add this
      ],
      required: true,
    },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    comment: { type: mongoose.Schema.Types.ObjectId }, // optional
    reply: { type: mongoose.Schema.Types.ObjectId }, // optional
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "BadgePayment" }, // for payment notifications
  }
);

// Add indexes for better performance
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);