const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: false, default: "" }, // Allow empty text for media-only messages
  mediaUrl: { type: String, default: null }, // URL to media file (image, video, etc.)
  mediaPublicId: { type: String, default: null }, // Cloudinary public_id for deletion
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null } // <-- Add replyTo field
});

// Add indexes for better performance
MessageSchema.index({ from: 1, to: 1 });
MessageSchema.index({ to: 1, read: 1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ to: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);