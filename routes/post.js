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

module.exports = router;