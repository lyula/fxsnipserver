const express = require("express");
const router = express.Router();
const { 
  createPost, 
  getPosts, 
  getFollowingPosts, // Add this line
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
  getPostLikes,
  incrementShareCount // Import incrementShareCount
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
router.post('/:id/view', incrementPostViews);

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
    let posts = await Post.find({ author: req.params.userId })
      .populate([
        { path: "author", select: "username verified profile.profileImage" },
        { path: "comments.author", select: "username verified profile.profileImage" },
        { path: "likes", select: "username verified profile.profileImage" }
      ])
      .lean();

    // Manually populate replies' authors
    for (const post of posts) {
      if (post.comments) {
        for (const comment of post.comments) {
          if (comment.replies && comment.replies.length > 0) {
            const replyAuthorIds = comment.replies.map(r => r.author).filter(Boolean);
            const replyAuthors = await User.find({ _id: { $in: replyAuthorIds } })
              .select("username verified profile.profileImage")
              .lean();
            const authorMap = Object.fromEntries(replyAuthors.map(a => [a._id.toString(), a]));
            comment.replies = comment.replies.map(reply => ({
              ...reply,
              author: authorMap[reply.author?.toString()] || reply.author
            }));
          }
        }
      }
    }

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's posts", details: error.message });
  }
});

// Get posts from followed users
router.get("/following", auth, getFollowingPosts);

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

// Get a single post by ID
router.get("/:postId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("author", "username verified")
      .populate("comments.author", "username verified")
      .populate("comments.replies.author", "username verified");
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Increment share count for a post (public, no auth required)
router.post('/:postId/share', incrementShareCount);

module.exports = router;