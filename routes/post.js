const express = require("express");
const router = express.Router();
const { createPost, getPosts, likePost, addComment } = require("../controllers/postController");
const auth = require("../middleware/auth");

// Create a new post
router.post("/", auth, createPost);

// Get all posts
router.get("/", getPosts);

// Like a post
router.post("/:postId/like", auth, likePost);

// Add a comment to a post
router.post("/:postId/comment", auth, addComment);

// Get posts by username (public profile)
router.get("/user/:username", async (req, res) => {
  try {
    const User = require("../models/User");
    const Post = require("../models/Post");
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find posts where author matches user's _id
    const posts = await Post.find({ author: user._id }).populate("author", "username verified");
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's posts" });
  }
});

module.exports = router;