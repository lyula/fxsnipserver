const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // recipient
    type: { type: String, required: true }, // e.g. "follow"
    text: { type: String, required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who triggered
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);