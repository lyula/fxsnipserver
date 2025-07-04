const express = require("express");
const router = express.Router();
const { 
  createPost, 
  getPosts, 
  likePost, 
  addComment, 
  addReply, 
  likeComment,    
  likeReply,
  incrementPostViews,
  editPost,
  deletePost,
  editComment,
  deleteComment,
  editReply,
  deleteReply,
  getPostLikes  // Add this import
} = require("../controllers/postController");
const auth = require("../middleware/auth");
const Post = require("../models/Post");
const User = require("../models/User");

// Create a new post
router.post("/", auth, createPost);

// Get all posts
router.get("/", auth, getPosts);

// Like a post
router.post("/:postId/like", auth, likePost);

// Like a comment
router.post("/:postId/comments/:commentId/like", auth, likeComment); 

// Like a reply
router.post("/:postId/comments/:commentId/replies/:replyId/like", auth, likeReply); 

// Add a comment to a post
router.post("/:postId/comments", auth, addComment);

// Add a reply to a comment
router.post("/:postId/comments/:commentId/replies", auth, addReply);

// Increment post views
router.post('/:postId/view', incrementPostViews);

// Track post view
router.post("/:id/view", async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json({ views: post.views });
  } catch (error) {
    console.error("Error tracking view:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
});

// Get posts by username (public profile)
router.get("/user/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find posts where author matches user's _id
    const posts = await Post.find({ author: user._id }).populate("author", "username verified");
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's posts" });
  }
});

// Get posts by user ID (robust to username changes)
router.get("/by-userid/:userId", async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId }).populate("author", "username verified");
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's posts" });
  }
});

// Edit and delete posts
router.put("/:postId", auth, editPost);
router.delete("/:postId", auth, deletePost);

// Edit and delete comments
router.put("/:postId/comments/:commentId", auth, editComment);
router.delete("/:postId/comments/:commentId", auth, deleteComment);

// Edit and delete replies
router.put("/:postId/comments/:commentId/replies/:replyId", auth, editReply);
router.delete("/:postId/comments/:commentId/replies/:replyId", auth, deleteReply);

// Get likes usernames for a post
router.get("/:postId/likes", auth, getPostLikes);

module.exports = router;