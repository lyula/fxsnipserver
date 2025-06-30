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

// Enhanced Get Posts with Infinite Scroll and Fresh Content Priority
exports.getPosts = async (req, res) => {
  try {
    const { 
      limit = 20,
      offset = 0,
      scrollDirection = 'down',
      refreshFeed = false
    } = req.query;

    const userId = req.user?.id;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

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
      })
      .sort({ createdAt: -1 });

    if (!posts || posts.length === 0) {
      return res.status(200).json({
        posts: [],
        hasMore: false,
        totalAvailablePosts: 0,
        nextOffset: offsetNum,
        scrollDirection,
        freshContentCount: 0
      });
    }

    // Calculate engagement and add status for each post
    const enrichedPosts = posts.map(post => {
      const postObj = post.toObject ? post.toObject() : post;
      
      // Safely calculate engagement metrics
      const likesCount = Array.isArray(postObj.likes) ? postObj.likes.length : 0;
      const commentsCount = Array.isArray(postObj.comments) ? postObj.comments.length : 0;
      const repliesCount = Array.isArray(postObj.comments) 
        ? postObj.comments.reduce((total, comment) => 
            total + (Array.isArray(comment.replies) ? comment.replies.length : 0), 0)
        : 0;
      const totalEngagement = likesCount + commentsCount + repliesCount;
      
      // Calculate time factors
      const now = new Date();
      const postAge = (now - new Date(postObj.createdAt)) / (1000 * 60 * 60); // hours
      const velocity = totalEngagement / Math.max(postAge, 0.1);
      
      // Determine post status
      let postStatus = null;
      if (velocity >= 5 && postAge <= 24) {
        postStatus = 'trending';
      } else if (totalEngagement >= 20 && postAge <= 6) {
        postStatus = 'hot';
      } else if (totalEngagement >= 50 && velocity >= 10) {
        postStatus = 'viral';
      }
      
      return {
        ...postObj,
        postStatus,
        _engagement: totalEngagement,
        _velocity: velocity,
        _postAge: postAge
      };
    });

    // Apply intelligent sorting for infinite scroll
    let sortedPosts;
    if (refreshFeed === 'true' || offsetNum === 0) {
      // Fresh load: prioritize fresh and engaging content
      sortedPosts = enrichedPosts.sort((a, b) => {
        // Prioritize fresh posts and high engagement
        const scoreA = (a._engagement * 0.4) + ((24 - Math.min(a._postAge, 24)) * 0.6);
        const scoreB = (b._engagement * 0.4) + ((24 - Math.min(b._postAge, 24)) * 0.6);
        return scoreB - scoreA;
      });
    } else {
      // Infinite scroll: ensure variety
      sortedPosts = enrichedPosts.sort((a, b) => {
        const scoreA = (a._engagement * 0.6) + ((24 - Math.min(a._postAge, 24)) * 0.4);
        const scoreB = (b._engagement * 0.6) + ((24 - Math.min(b._postAge, 24)) * 0.4);
        return scoreB - scoreA;
      });
    }

    // Implement cycling for infinite scroll (never-ending feed)
    const totalPosts = sortedPosts.length;
    const paginatedPosts = [];
    
    for (let i = 0; i < limitNum && totalPosts > 0; i++) {
      const index = (offsetNum + i) % totalPosts;
      paginatedPosts.push(sortedPosts[index]);
    }

    res.status(200).json({
      posts: paginatedPosts,
      hasMore: totalPosts > 0, // Always true if there are posts for infinite scroll
      totalAvailablePosts: totalPosts,
      nextOffset: offsetNum + limitNum,
      scrollDirection,
      freshContentCount: enrichedPosts.filter(p => p._postAge < 2).length
    });

  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ 
      error: "Failed to fetch posts", 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

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

// Edit a comment
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

// Edit a reply
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