const Post = require("../models/Post");
const Notification = require("../models/Notification");

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { content, image, video } = req.body;  // Add video to destructuring
    const post = new Post({
      content,
      image,
      video,  // Add video field
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

// Enhanced Get Posts with Fresh Content that targets unseen posts from today
exports.getPosts = async (req, res) => {
  try {
    const { 
      limit = 20,
      offset = 0,
      scrollDirection = 'down',
      refreshFeed = false,
      loadFresh = false,
      timestamp,
      cacheBust
    } = req.query;

    const userId = req.user?.id;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Get user's viewing history from the last session (you might want to store this in DB)
    // For now, we'll use time-based logic
    
    let query = {};
    let sortOptions = { createdAt: -1 };

    // FRESH CONTENT LOGIC: Get posts from the last few hours to the current day
    if (loadFresh === 'true' || scrollDirection === 'fresh') {
      console.log('Loading fresh content: posts from the last few minutes to today');
      
      // Get posts from the last 4 hours (recent) and today (might have missed)
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      
      // Priority 1: Posts from last 4 hours (very fresh)
      // Priority 2: Posts from today that user might have missed
      query = {
        createdAt: { 
          $gte: startOfToday // All posts from today
        }
      };
      
      // Enhanced sort for fresh content
      sortOptions = { 
        createdAt: -1, // Newest first
        views: 1       // Lower view count first (less seen posts)
      };
    }

    // Get posts with populated fields
    const posts = await Post.find(query)
      .populate("author", "username verified countryFlag")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "username verified"
        }
      })
      .populate({
        path: "comments.replies.author", 
        select: "username verified"
      })
      .sort(sortOptions)
      .lean(); // Use lean for better performance

    if (!posts || posts.length === 0) {
      return res.status(200).json({
        posts: [],
        hasMore: false,
        totalAvailablePosts: 0,
        nextOffset: offsetNum,
        scrollDirection,
        freshContentCount: 0,
        cyclingInfo: {
          completedCycles: 0,
          positionInCurrentCycle: 0,
          totalPostsInCycle: 0,
          isRepeatingContent: false,
          freshContentLoaded: loadFresh === 'true'
        }
      });
    }

    // Calculate time-based metrics for each post
    const now = new Date();
    const enrichedPosts = posts.map(post => {
      const postAge = (now - new Date(post.createdAt)) / (1000 * 60); // age in minutes
      const hoursSincePost = postAge / 60;
      
      // Calculate engagement metrics
      const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
      const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
      const viewsCount = post.views || 0;
      const totalEngagement = likesCount + commentsCount;
      
      // Fresh content scoring
      let freshScore = 0;
      
      if (loadFresh === 'true') {
        // Score based on recency and engagement
        if (postAge < 30) { // Last 30 minutes
          freshScore = 100 + totalEngagement * 2; // Highest priority
        } else if (postAge < 120) { // Last 2 hours  
          freshScore = 80 + totalEngagement * 1.5;
        } else if (postAge < 360) { // Last 6 hours
          freshScore = 60 + totalEngagement;
        } else { // Rest of today
          freshScore = 40 + totalEngagement * 0.5;
        }
        
        // Boost posts with lower view counts (likely unseen)
        if (viewsCount < 10) freshScore += 20;
        if (viewsCount < 5) freshScore += 30;
      }
      
      return {
        ...post,
        _postAgeMinutes: postAge,
        _postAgeHours: hoursSincePost,
        _freshScore: freshScore,
        _engagement: totalEngagement,
        _views: viewsCount
      };
    });

    let sortedPosts;
    
    if (loadFresh === 'true') {
      console.log(`Processing ${enrichedPosts.length} posts for fresh content`);
      
      // Sort by fresh score (prioritizes recent + unseen posts)
      sortedPosts = enrichedPosts.sort((a, b) => {
        return b._freshScore - a._freshScore;
      });
      
      // Get the requested slice
      const freshPosts = sortedPosts.slice(offsetNum, offsetNum + limitNum).map((post, index) => ({
        ...post,
        _scrollPosition: offsetNum + index,
        _isFreshContent: true
      }));
      
      // Count truly fresh posts (last 2 hours)
      const recentFreshCount = sortedPosts.filter(p => p._postAgeHours < 2).length;
      
      console.log(`Returning ${freshPosts.length} fresh posts, ${recentFreshCount} from last 2 hours`);
      
      return res.status(200).json({
        posts: freshPosts,
        hasMore: (offsetNum + limitNum) < sortedPosts.length,
        totalAvailablePosts: sortedPosts.length,
        nextOffset: offsetNum + limitNum,
        scrollDirection: 'down',
        freshContentCount: recentFreshCount,
        cyclingInfo: {
          completedCycles: 0,
          positionInCurrentCycle: offsetNum,
          totalPostsInCycle: sortedPosts.length,
          isRepeatingContent: false,
          freshContentLoaded: true,
          postsFromToday: sortedPosts.length
        }
      });
      
    } else if (refreshFeed === 'true' || offsetNum === 0) {
      // Regular refresh: balanced fresh and engaging content
      sortedPosts = enrichedPosts.sort((a, b) => {
        const scoreA = (a._engagement * 0.4) + ((24 - Math.min(a._postAgeHours, 24)) * 0.6);
        const scoreB = (b._engagement * 0.4) + ((24 - Math.min(b._postAgeHours, 24)) * 0.6);
        return scoreB - scoreA;
      });
    } else {
      // Infinite scroll: ensure variety
      sortedPosts = enrichedPosts.sort((a, b) => {
        const scoreA = (a._engagement * 0.6) + ((24 - Math.min(a._postAgeHours, 24)) * 0.4);
        const scoreB = (b._engagement * 0.6) + ((24 - Math.min(b._postAgeHours, 24)) * 0.4);
        return scoreB - scoreA;
      });
    }

    // Regular pagination for non-fresh content
    const totalPosts = sortedPosts.length;
    const paginatedPosts = [];
    
    if (totalPosts > 0) {
      for (let i = 0; i < limitNum; i++) {
        const index = offsetNum + i;
        if (index < totalPosts) {
          const selectedPost = { ...sortedPosts[index] };
          selectedPost._scrollPosition = index;
          paginatedPosts.push(selectedPost);
        }
      }
    }

    const hasMore = (offsetNum + limitNum) < totalPosts;
    const completedCycles = Math.floor(offsetNum / Math.max(totalPosts, 1));

    res.status(200).json({
      posts: paginatedPosts,
      hasMore,
      totalAvailablePosts: totalPosts,
      nextOffset: offsetNum + limitNum,
      scrollDirection,
      freshContentCount: 0,
      cyclingInfo: {
        completedCycles,
        positionInCurrentCycle: offsetNum % Math.max(totalPosts, 1),
        totalPostsInCycle: totalPosts,
        isRepeatingContent: completedCycles > 0
      }
    });

  } catch (error) {
    console.error("Error in getPosts:", error);
    res.status(500).json({ 
      error: "Failed to fetch posts",
      details: error.message
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