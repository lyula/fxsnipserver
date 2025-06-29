const mongoose = require("mongoose");

// Define the schema for replies
const replySchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // <-- Add this line
  createdAt: { type: Date, default: Date.now },
});

// Define the schema for comments
const commentSchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // <-- Add this line
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now },
});

// Define the schema for posts
const postSchema = new mongoose.Schema(
  {
    content: String,
    image: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comments: [commentSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Already present
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Apply the schema to the Post model
module.exports = mongoose.model("Post", postSchema);