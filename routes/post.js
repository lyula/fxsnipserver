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
  incrementShareCount, // Import incrementShareCount
  trackAdImpression,  // Add ad tracking
  trackAdClick       // Add ad tracking
} = require("../controllers/postController");
const { requireAuth: auth } = require("../middleware/auth");
const { 
  canCreatePost, 
  canLikePost, 
  canComment, 
  canShare 
} = require("../middleware/checkRestrictions");
const Post = require("../models/Post");
const User = require("../models/User");

// Create a new post (with restriction check)
router.post("/", auth, canCreatePost, createPost);

// Get all posts
router.get("/", auth, getPosts);

// Like a post (with restriction check)
router.post("/:postId/like", auth, canLikePost, likePost);

// Like a comment (with restriction check)
router.post("/:postId/comments/:commentId/like", auth, canLikePost, likeComment); 

// Like a reply (with restriction check)
router.post("/:postId/comments/:commentId/replies/:replyId/like", auth, canLikePost, likeReply); 

// Add a comment to a post (with restriction check)
router.post("/:postId/comments", auth, canComment, addComment);

// Add a reply to a comment (with restriction check)
router.post("/:postId/comments/:commentId/replies", auth, canComment, addReply);

// Increment post views - using auth middleware and controller function
router.post('/:id/view', auth, incrementPostViews);

// Get posts by username
router.get("/user/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find posts where author matches user's _id, excluding hidden and deleted posts
    const posts = await Post.find({ 
      author: user._id,
      isHidden: { $ne: true },
      isDeleted: { $ne: true }
    }).populate("author", "username verified");
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's posts" });
  }
});

// Get posts by user ID (robust to username changes)
router.get("/by-userid/:userId", async (req, res) => {
  try {
    let posts = await Post.find({ 
      author: req.params.userId,
      isHidden: { $ne: true },
      isDeleted: { $ne: true }
    })
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


// Search posts by content or author username
router.get("/search", auth, require("../controllers/postController").searchPosts);

// Get posts from followed users
router.get("/following", auth, getFollowingPosts);

// Edit and delete posts
router.put("/:postId", auth, editPost);
router.delete("/:postId", auth, deletePost);


// Get all comments for a post
router.get("/:postId/comments", auth, require("../controllers/postController").getPostComments);

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
      .populate("author", "username verified countryFlag profile profileImage")
      .populate("comments.author", "username verified profile profileImage")
      .populate("comments.replies.author", "username verified profile profileImage");
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Increment share count for a post (with auth and restriction check)
router.post('/:postId/share', auth, canShare, incrementShareCount);

// Ad tracking routes
router.post('/ads/:adId/impression', auth, trackAdImpression);
router.post('/ads/:adId/click', auth, trackAdClick);

module.exports = router;