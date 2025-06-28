const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema(
  {
    content: String,
    image: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comments: [commentSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);