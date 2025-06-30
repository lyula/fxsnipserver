const Post = require("../models/Post");
const Notification = require("../models/Notification");

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { content, image } = req.body;
    const post = new Post({
      content,
      image,
      author: req.user.id,
      comments: [],
      likes: [],
    });
    await post.save();
    // Populate author before sending response
    await post.populate("author", "username verified");
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to create post" });
  }
};

// Enhanced Get Posts with Viral Algorithm
exports.getPosts = async (req, res) => {
  try {
    const { 
      algorithm = 'viral', // 'viral', 'recent', 'trending', 'random'
      limit = 20,
      offset = 0,
      refreshFeed = false // Force refresh with new randomization
    } = req.query;

    // Get all posts with populated fields
    const posts = await Post.find()
      .populate("author", "username verified")
      .populate({
        path: "comments.author",
        select: "username verified",
      })
      .populate({
        path: "comments.replies.author",
        select: "username verified",
      });

    // Calculate engagement scores and apply viral algorithm
    const rankedPosts = calculateViralScore(posts, algorithm, refreshFeed);
    
    // Apply pagination
    const paginatedPosts = rankedPosts.slice(offset, offset + parseInt(limit));
    
    res.status(200).json({
      posts: paginatedPosts,
      totalPosts: rankedPosts.length,
      hasMore: (offset + parseInt(limit)) < rankedPosts.length,
      algorithm: algorithm
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// Viral Algorithm Implementation
function calculateViralScore(posts, algorithm, refreshFeed) {
  const now = new Date();
  
  const scoredPosts = posts.map(post => {
    // Calculate basic engagement metrics
    const likesCount = post.likes ? post.likes.length : 0;
    const commentsCount = post.comments ? post.comments.length : 0;
    const repliesCount = post.comments 
      ? post.comments.reduce((total, comment) => 
          total + (comment.replies ? comment.replies.length : 0), 0)
      : 0;
    const viewsCount = post.views || 0;
    
    // Calculate total engagement
    const totalEngagement = likesCount + commentsCount + repliesCount;
    
    // Time-based factors
    const postAge = (now - new Date(post.createdAt)) / (1000 * 60 * 60); // hours
    const recentActivity = (now - new Date(post.updatedAt)) / (1000 * 60 * 60); // hours
    
    // Viral Score Components
    const engagementScore = (likesCount * 1) + (commentsCount * 2) + (repliesCount * 1.5);
    const velocityScore = totalEngagement / Math.max(postAge, 0.1); // engagement per hour
    const freshnessScore = Math.max(0, 24 - postAge) / 24; // newer posts get higher score
    const viralityScore = calculateViralityMultiplier(totalEngagement, postAge);
    const viewRatio = viewsCount > 0 ? totalEngagement / viewsCount : 0;
    
    // Random factor for feed diversity (changes on refresh)
    const randomFactor = refreshFeed === 'true' ? Math.random() : 
      ((post._id.toString().charCodeAt(0) + post._id.toString().charCodeAt(1)) % 100) / 100;
    
    let finalScore = 0;
    
    switch (algorithm) {
      case 'viral':
        finalScore = (
          (engagementScore * 0.3) +
          (velocityScore * 0.25) +
          (viralityScore * 0.25) +
          (freshnessScore * 0.1) +
          (viewRatio * 100 * 0.05) +
          (randomFactor * 0.05)
        );
        break;
        
      case 'trending':
        finalScore = (velocityScore * 0.5) + (engagementScore * 0.3) + (freshnessScore * 0.2);
        break;
        
      case 'recent':
        finalScore = (freshnessScore * 0.7) + (engagementScore * 0.2) + (randomFactor * 0.1);
        break;
        
      case 'random':
        finalScore = randomFactor + (engagementScore * 0.1);
        break;
        
      default:
        finalScore = engagementScore;
    }
    
    return {
      ...post.toObject(),
      _viralScore: finalScore,
      _engagement: totalEngagement,
      _velocity: velocityScore,
      _virality: viralityScore
    };
  });
  
  // Sort by viral score (highest first)
  return scoredPosts.sort((a, b) => b._viralScore - a._viralScore);
}

// Calculate virality multiplier based on engagement patterns
function calculateViralityMultiplier(engagement, ageInHours) {
  if (ageInHours < 1) {
    // Very new posts: high engagement = viral potential
    if (engagement >= 20) return 3.0;
    if (engagement >= 10) return 2.5;
    if (engagement >= 5) return 2.0;
    return 1.0;
  } else if (ageInHours < 6) {
    // Recent posts: sustained engagement
    if (engagement >= 50) return 2.8;
    if (engagement >= 25) return 2.3;
    if (engagement >= 10) return 1.8;
    return 1.0;
  } else if (ageInHours < 24) {
    // Day-old posts: exceptional engagement needed
    if (engagement >= 100) return 2.5;
    if (engagement >= 50) return 2.0;
    if (engagement >= 25) return 1.5;
    return 0.8;
  } else if (ageInHours < 72) {
    // Older posts: only truly viral content resurfaces
    if (engagement >= 200) return 2.0;
    if (engagement >= 100) return 1.5;
    return 0.5;
  } else {
    // Very old posts: rare resurface
    if (engagement >= 500) return 1.2;
    return 0.2;
  }
}

// Like a post (with toggle functionality)
exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Toggle like functionality
    const userIndex = post.likes.indexOf(req.user.id);
    if (userIndex === -1) {
      // User hasn't liked this post yet, add like
      post.likes.push(req.user.id);
      
      // Send notification to the post author (only when liking, not unliking)
      if (post.author.toString() !== req.user.id) {
        await Notification.create({
          user: post.author,
          from: req.user.id,
          type: "like_post",
          post: post._id,
          message: `${req.user.username} liked your post.`,
        });
      }
    } else {
      // User has already liked this post, remove like (unlike)
      post.likes.splice(userIndex, 1);
    }

    await post.save();

    // Populate author fields for response
    await post.populate([
      { path: "author", select: "username verified" },
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" }
    ]);

    res.status(200).json(post);
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const newComment = { content, author: req.user.id };
    post.comments.push(newComment);
    await post.save();

    // Send notification to the post author
    if (post.author.toString() !== req.user.id) {
      await Notification.create({
        user: post.author,
        from: req.user.id,
        type: "comment",
        post: post._id,
        message: `${req.user.username} commented on your post.`,
      });
    }

    // Populate author for the last comment (the one just added)
    await post.populate([
      { path: "author", select: "username verified" },
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" }
    ]);

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
};

// Like a comment on a post
exports.likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    // Toggle like functionality
    const userIndex = comment.likes.indexOf(req.user.id);
    if (userIndex === -1) {
      // User hasn't liked this comment yet, add like
      comment.likes.push(req.user.id);
      
      // Send notification to the comment author (only when liking, not unliking)
      if (comment.author.toString() !== req.user.id) {
        await Notification.create({
          user: comment.author,
          from: req.user.id,
          type: "like_comment",
          post: post._id,
          comment: comment._id,
          message: `${req.user.username} liked your comment on a post.`,
        });
      }
    } else {
      // User has already liked this comment, remove like (unlike)
      comment.likes.splice(userIndex, 1);
    }

    await post.save();

    // Populate author fields for response using modern populate method
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);

    res.status(200).json(post);
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({ error: "Failed to like comment" });
  }
};

// Like a reply to a comment on a post
exports.likeReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });

    // Toggle like functionality
    const userIndex = reply.likes.indexOf(req.user.id);
    if (userIndex === -1) {
      // User hasn't liked this reply yet, add like
      reply.likes.push(req.user.id);
      
      // Send notification to the reply author (only when liking, not unliking)
      if (reply.author.toString() !== req.user.id) {
        await Notification.create({
          user: reply.author,
          from: req.user.id,
          type: "like_reply",
          post: post._id,
          comment: comment._id,
          reply: reply._id,
          message: `${req.user.username} liked your reply on a post.`,
        });
      }
    } else {
      // User has already liked this reply, remove like (unlike)
      reply.likes.splice(userIndex, 1);
    }

    await post.save();

    // Populate author fields for response using modern populate method
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);

    res.status(200).json(post);
  } catch (error) {
    console.error("Error liking reply:", error);
    res.status(500).json({ error: "Failed to like reply" });
  }
};

// Add a reply to a comment
exports.addReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const newReply = { content, author: req.user.id };
    comment.replies.push(newReply);
    await post.save();

    // Send notification to the comment author
    if (comment.author.toString() !== req.user.id) {
      await Notification.create({
        user: comment.author,
        from: req.user.id,
        type: "reply",
        post: post._id,
        comment: comment._id,
        message: `${req.user.username} replied to your comment on a post.`,
      });
    }

    // Populate author fields for response
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);
    
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to add reply" });
  }
};

// Increment post views
exports.incrementPostViews = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json({ views: post.views });
  } catch (err) {
    console.error("Error incrementing post views:", err);
    res.status(500).json({ error: "Failed to increment views" });
  }
};

// Get notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate("from", "username verified") // populate actor info
      .populate("post", "content") // populate post info (add more fields as needed)
      .lean();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Edit a post
exports.editPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, image } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    // Check if user is the author
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this post" });
    }
    
    post.content = content;
    if (image !== undefined) post.image = image;
    post.editedAt = new Date();
    post.isEdited = true;
    
    await post.save();
    
    // Populate author fields for response
    await post.populate([
      { path: "author", select: "username verified" },
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" }
    ]);
    
    res.status(200).json(post);
  } catch (error) {
    console.error("Error editing post:", error);
    res.status(500).json({ error: "Failed to edit post" });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    // Check if user is the author
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }
    
    // Delete all notifications related to this post
    await Notification.deleteMany({ post: postId });
    
    // Delete the post
    await Post.findByIdAndDelete(postId);
    
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// Edit a comment - REPLACE EXISTING editComment FUNCTION
exports.editComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    
    // Check if user is the comment author
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this comment" });
    }
    
    comment.content = content;
    comment.editedAt = new Date();
    comment.isEdited = true;
    comment.updatedAt = new Date(); // Manually set since subdocs don't auto-update
    
    // Mark the post as modified to trigger save
    post.markModified('comments');
    await post.save();
    
    // Populate author fields for response
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);
    
    res.status(200).json(post);
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({ error: "Failed to edit comment" });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    
    // Check if user is the comment author or post author
    if (comment.author.toString() !== req.user.id && post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this comment" });
    }
    
    // Delete all notifications related to this comment
    await Notification.deleteMany({ comment: commentId });
    
    // Remove the comment
    post.comments.pull(commentId);
    await post.save();
    
    // Populate author fields for response
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);
    
    res.status(200).json(post);
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// Edit a reply - REPLACE EXISTING editReply FUNCTION  
exports.editReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const { content } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    
    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    
    // Check if user is the reply author
    if (reply.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this reply" });
    }
    
    reply.content = content;
    reply.editedAt = new Date();
    reply.isEdited = true;
    reply.updatedAt = new Date(); // Manually set since subdocs don't auto-update
    
    // Mark the post as modified to trigger save
    post.markModified('comments');
    await post.save();
    
    // Populate author fields for response
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);
    
    res.status(200).json(post);
  } catch (error) {
    console.error("Error editing reply:", error);
    res.status(500).json({ error: "Failed to edit reply" });
  }
};

// Delete a reply
exports.deleteReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    
    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    
    // Check if user is the reply author, comment author, or post author
    if (reply.author.toString() !== req.user.id && 
        comment.author.toString() !== req.user.id && 
        post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this reply" });
    }
    
    // Delete all notifications related to this reply
    await Notification.deleteMany({ reply: replyId });
    
    // Remove the reply
    comment.replies.pull(replyId);
    await post.save();
    
    // Populate author fields for response
    await post.populate([
      { path: "comments.author", select: "username verified" },
      { path: "comments.replies.author", select: "username verified" },
      { path: "author", select: "username verified" }
    ]);
    
    res.status(200).json(post);
  } catch (error) {
    console.error("Error deleting reply:", error);
    res.status(500).json({ error: "Failed to delete reply" });
  }
};