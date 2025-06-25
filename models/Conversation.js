const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // The other user in the conversation
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
}, { timestamps: true });

module.exports = mongoose.model("Conversation", ConversationSchema);