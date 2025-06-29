const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

// Add indexes for better performance
MessageSchema.index({ from: 1, to: 1 });
MessageSchema.index({ to: 1, read: 1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ to: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);