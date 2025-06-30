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
      lastPostId = null,
      scrollDirection = 'down', // 'down' or 'up'
      refreshFeed = false
    } = req.query;

    // Get user ID for personalization
    const userId = req.user.id;

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

    // Get user's interaction history for personalization
    const userInteractions = await getUserInteractionHistory(userId);
    
    // Get user's viewed posts to avoid immediate repetition
    const viewedPosts = await getUserViewedPosts(userId);
    
    // Calculate intelligent ranking with infinite scroll logic
    const rankedPosts = calculateInfiniteScrollRanking(
      posts, 
      userInteractions, 
      viewedPosts,
      parseInt(offset),
      scrollDirection,
      refreshFeed
    );
    
    // Apply pagination with overlap for endless scrolling
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPosts = rankedPosts.slice(startIndex, endIndex);
    
    // Add post status indicators
    const postsWithStatus = paginatedPosts.map(post => ({
      ...post,
      postStatus: getPostStatus(post)
    }));
    
    // Calculate if there are more posts (always true for infinite scroll)
    const hasMore = true; // Always true for endless scrolling
    const totalAvailablePosts = rankedPosts.length;
    
    res.status(200).json({
      posts: postsWithStatus,
      hasMore,
      totalAvailablePosts,
      nextOffset: endIndex,
      scrollDirection,
      freshContentCount: getFreshContentCount(posts, userInteractions.lastSeenTime)
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// Get user's viewed posts for intelligent rotation
async function getUserViewedPosts(userId) {
  try {
    // In a real app, you'd store this in a separate collection or user field
    // For now, we'll use a simple approach based on recent views
    const recentViews = await Post.find({ 
      views: { $gt: 0 } 
    }).select('_id views').lean();
    
    return recentViews.map(post => post._id.toString());
  } catch (error) {
    return [];
  }
}

// Enhanced ranking for infinite scroll with content rotation
function calculateInfiniteScrollRanking(posts, userInteractions, viewedPosts, offset, scrollDirection, refreshFeed) {
  const now = new Date();
  const isFirstLoad = offset === 0;
  
  // Separate posts into categories
  const freshPosts = [];
  const viralPosts = [];
  const personalizedPosts = [];
  const regularPosts = [];
  
  const scoredPosts = posts.map(post => {
    const postId = post._id.toString();
    const wasViewed = viewedPosts.includes(postId);
    
    // Calculate basic metrics
    const likesCount = post.likes ? post.likes.length : 0;
    const commentsCount = post.comments ? post.comments.length : 0;
    const repliesCount = post.comments 
      ? post.comments.reduce((total, comment) => 
          total + (comment.replies ? comment.replies.length : 0), 0)
      : 0;
    const viewsCount = post.views || 0;
    const totalEngagement = likesCount + commentsCount + repliesCount;
    
    // Time-based factors
    const postAge = (now - new Date(post.createdAt)) / (1000 * 60 * 60); // hours
    const freshnessScore = Math.max(0, 24 - postAge) / 24;
    const velocityScore = totalEngagement / Math.max(postAge, 0.1);
    const viralityScore = calculateViralityMultiplier(totalEngagement, postAge);
    
    // Personalization factors
    const authorId = post.author && post.author._id ? post.author._id.toString() : null;
    const authorPreference = authorId && userInteractions.preferredAuthors[authorId] 
      ? Math.min(userInteractions.preferredAuthors[authorId] * 0.3, 2.0) : 0;
    const contentSimilarity = calculateContentSimilarity(post.content, userInteractions.contentKeywords);
    
    // Infinite scroll factors
    const viewPenalty = wasViewed ? 0.3 : 1.0; // Reduce score for already viewed posts
    const positionBoost = calculatePositionBoost(offset, scrollDirection);
    const diversityFactor = calculateDiversityFactor(post, offset);
    
    // Random factor for variety (seed-based for consistency)
    const randomFactor = ((postId.charCodeAt(0) + postId.charCodeAt(1) + offset) % 100) / 100;
    
    // Calculate scores for different categories
    const engagementScore = (likesCount * 1) + (commentsCount * 2) + (repliesCount * 1.5);
    const personalizedScore = authorPreference + (contentSimilarity * 0.5);
    
    const finalScore = (
      (engagementScore * 0.2) +
      (velocityScore * 0.15) +
      (viralityScore * 0.15) +
      (freshnessScore * 0.2) +
      (personalizedScore * 0.1) +
      (positionBoost * 0.1) +
      (diversityFactor * 0.05) +
      (randomFactor * 0.05)
    ) * viewPenalty;
    
    const enrichedPost = {
      ...post.toObject(),
      _score: finalScore,
      _engagement: totalEngagement,
      _velocity: velocityScore,
      _virality: viralityScore,
      _freshness: freshnessScore,
      _personalized: personalizedScore,
      _wasViewed: wasViewed,
      _postAge: postAge
    };
    
    // Categorize posts
    if (postAge < 2 && !wasViewed) {
      freshPosts.push(enrichedPost);
    } else if (viralityScore >= 2.0 && totalEngagement >= 15) {
      viralPosts.push(enrichedPost);
    } else if (personalizedScore > 0.5) {
      personalizedPosts.push(enrichedPost);
    } else {
      regularPosts.push(enrichedPost);
    }
    
    return enrichedPost;
  });
  
  // Sort each category
  freshPosts.sort((a, b) => b._score - a._score);
  viralPosts.sort((a, b) => b._score - a._score);
  personalizedPosts.sort((a, b) => b._score - a._score);
  regularPosts.sort((a, b) => b._score - a._score);
  
  // Create intelligent mix based on scroll position and direction
  return createIntelligentMix(freshPosts, viralPosts, personalizedPosts, regularPosts, offset, scrollDirection, isFirstLoad);
}

// Create intelligent content mix for infinite scroll
function createIntelligentMix(freshPosts, viralPosts, personalizedPosts, regularPosts, offset, scrollDirection, isFirstLoad) {
  const mixedPosts = [];
  
  if (isFirstLoad) {
    // First load: prioritize fresh and viral content
    const freshChunk = freshPosts.slice(0, 5);
    const viralChunk = viralPosts.slice(0, 3);
    const personalizedChunk = personalizedPosts.slice(0, 4);
    const regularChunk = regularPosts.slice(0, 8);
    
    // Interleave content types
    mixedPosts.push(...freshChunk);
    mixedPosts.push(...viralChunk);
    mixedPosts.push(...personalizedChunk);
    mixedPosts.push(...regularChunk);
  } else {
    // Subsequent loads: rotate content types based on position
    const chunkSize = Math.max(2, Math.floor(20 / 4));
    const chunkOffset = Math.floor(offset / 20);
    
    // Calculate dynamic distribution based on scroll position
    const freshRatio = Math.max(0.2, 0.4 - (chunkOffset * 0.05));
    const viralRatio = Math.min(0.4, 0.2 + (chunkOffset * 0.02));
    const personalizedRatio = Math.min(0.3, 0.2 + (chunkOffset * 0.01));
    const regularRatio = 1 - freshRatio - viralRatio - personalizedRatio;
    
    // Calculate chunk sizes
    const freshSize = Math.floor(20 * freshRatio);
    const viralSize = Math.floor(20 * viralRatio);
    const personalizedSize = Math.floor(20 * personalizedRatio);
    const regularSize = 20 - freshSize - viralSize - personalizedSize;
    
    // Get chunks with offset rotation
    const freshChunk = getRotatedChunk(freshPosts, freshSize, chunkOffset);
    const viralChunk = getRotatedChunk(viralPosts, viralSize, chunkOffset);
    const personalizedChunk = getRotatedChunk(personalizedPosts, personalizedSize, chunkOffset);
    const regularChunk = getRotatedChunk(regularPosts, regularSize, chunkOffset);
    
    // Interleave chunks in a pattern
    const pattern = [freshChunk, viralChunk, personalizedChunk, regularChunk];
    let patternIndex = 0;
    
    while (mixedPosts.length < 20 && pattern.some(chunk => chunk.length > 0)) {
      const currentChunk = pattern[patternIndex % pattern.length];
      if (currentChunk.length > 0) {
        mixedPosts.push(currentChunk.shift());
      }
      patternIndex++;
    }
  }
  
  // Ensure we have enough content by cycling through all posts if needed
  const allPosts = [...freshPosts, ...viralPosts, ...personalizedPosts, ...regularPosts];
  while (mixedPosts.length < 20 * 10) { // Support up to 200 posts worth of content
    const cycleIndex = mixedPosts.length % allPosts.length;
    if (allPosts[cycleIndex]) {
      mixedPosts.push(allPosts[cycleIndex]);
    } else {
      break;
    }
  }
  
  return mixedPosts;
}

// Get rotated chunk to ensure content variety
function getRotatedChunk(posts, size, offset) {
  if (!posts.length) return [];
  
  const startIndex = (offset * size) % posts.length;
  const chunk = [];
  
  for (let i = 0; i < size; i++) {
    const index = (startIndex + i) % posts.length;
    if (posts[index]) {
      chunk.push(posts[index]);
    }
  }
  
  return chunk;
}

// Calculate position boost for better distribution
function calculatePositionBoost(offset, scrollDirection) {
  if (scrollDirection === 'up') {
    // Boost fresh content when scrolling up
    return 0.3;
  }
  
  // Gradual boost for deeper content
  return Math.min(0.2, offset * 0.001);
}

// Calculate diversity factor to prevent content clustering
function calculateDiversityFactor(post, offset) {
  const authorId = post.author && post.author._id ? post.author._id.toString() : 'unknown';
  const authorHash = authorId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const diversityScore = (authorHash + offset) % 100;
  
  return diversityScore / 1000; // Small factor for diversity
}

// Get count of fresh content
function getFreshContentCount(posts, lastSeenTime) {
  if (!lastSeenTime) return posts.length;
  
  const cutoff = new Date(lastSeenTime);
  return posts.filter(post => new Date(post.createdAt) > cutoff).length;
}

// Get user interaction history for personalization
async function getUserInteractionHistory(userId) {
  try {
    // Get posts the user has liked
    const likedPosts = await Post.find({ likes: userId })
      .populate("author", "username")
      .select("author content createdAt");
    
    // Get posts the user has commented on
    const commentedPosts = await Post.find({ 
      "comments.author": userId 
    })
      .populate("author", "username")
      .select("author content createdAt");
    
    // Extract preferred authors and content patterns
    const preferredAuthors = {};
    const contentKeywords = [];
    
    [...likedPosts, ...commentedPosts].forEach(post => {
      if (post.author && post.author._id) {
        const authorId = post.author._id.toString();
        preferredAuthors[authorId] = (preferredAuthors[authorId] || 0) + 1;
      }
      
      // Extract keywords from content (simple implementation)
      if (post.content) {
        const words = post.content.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 4); // Only longer words
        contentKeywords.push(...words);
      }
    });
    
    return {
      preferredAuthors,
      contentKeywords,
      totalInteractions: likedPosts.length + commentedPosts.length
    };
  } catch (error) {
    console.error("Error getting user interactions:", error);
    return { preferredAuthors: {}, contentKeywords: [], totalInteractions: 0 };
  }
}

// Intelligent ranking algorithm with personalization
function calculateIntelligentRanking(posts, userInteractions, refreshFeed) {
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
    
    // Engagement scoring
    const engagementScore = (likesCount * 1) + (commentsCount * 2) + (repliesCount * 1.5);
    const velocityScore = totalEngagement / Math.max(postAge, 0.1); // engagement per hour
    const freshnessScore = Math.max(0, 24 - postAge) / 24; // newer posts get higher score
    const viralityScore = calculateViralityMultiplier(totalEngagement, postAge);
    const viewRatio = viewsCount > 0 ? totalEngagement / viewsCount : 0;
    
    // Personalization factors
    const authorId = post.author && post.author._id ? post.author._id.toString() : null;
    const authorPreference = authorId && userInteractions.preferredAuthors[authorId] 
      ? Math.min(userInteractions.preferredAuthors[authorId] * 0.3, 2.0) : 0;
    
    // Content similarity (simple keyword matching)
    const contentSimilarity = calculateContentSimilarity(post.content, userInteractions.contentKeywords);
    
    // Random factor for diversity
    const randomFactor = refreshFeed === 'true' ? Math.random() : 
      ((post._id.toString().charCodeAt(0) + post._id.toString().charCodeAt(1)) % 100) / 100;
    
    // Calculate final intelligent score
    const baseScore = (
      (engagementScore * 0.25) +
      (velocityScore * 0.20) +
      (viralityScore * 0.20) +
      (freshnessScore * 0.15) +
      (viewRatio * 100 * 0.05) +
      (randomFactor * 0.15)
    );
    
    // Apply personalization boost
    const personalizedScore = baseScore + authorPreference + (contentSimilarity * 0.5);
    
    return {
      ...post.toObject(),
      _intelligentScore: personalizedScore,
      _engagement: totalEngagement,
      _velocity: velocityScore,
      _virality: viralityScore,
      _authorPreference: authorPreference,
      _contentSimilarity: contentSimilarity
    };
  });
  
  // Sort by intelligent score (highest first)
  return scoredPosts.sort((a, b) => b._intelligentScore - a._intelligentScore);
}

// Calculate content similarity based on user's interaction history
function calculateContentSimilarity(content, userKeywords) {
  if (!content || !userKeywords.length) return 0;
  
  const postWords = content.toLowerCase().split(/\s+/);
  const matches = postWords.filter(word => userKeywords.includes(word));
  
  return Math.min(matches.length / Math.max(postWords.length, 1), 0.3);
}

// Determine post status (viral, trending, etc.)
function getPostStatus(post) {
  const engagement = post._engagement || 0;
  const velocity = post._velocity || 0;
  const virality = post._virality || 0;
  const ageInHours = (new Date() - new Date(post.createdAt)) / (1000 * 60 * 60);
  
  // Viral: High engagement with high virality multiplier
  if (virality >= 2.0 && engagement >= 20) {
    return 'viral';
  }
  
  // Trending: High velocity (rapid engagement)
  if (velocity >= 5 && ageInHours <= 24) {
    return 'trending';
  }
  
  // Hot: Good engagement within last few hours
  if (engagement >= 10 && ageInHours <= 6) {
    return 'hot';
  }
  
  return null; // No special status
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

// Viral Algorithm Implementation
function calculateViralityMultiplier(posts, algorithm, refreshFeed) {
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