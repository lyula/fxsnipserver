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
      ],
      required: true,
    },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    comment: { type: mongoose.Schema.Types.ObjectId }, // optional
    reply: { type: mongoose.Schema.Types.ObjectId }, // optional
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }
);

module.exports = mongoose.model("Notification", notificationSchema);