const PostReport = require("../models/PostReport");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");

// User: Report a post
exports.reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reasonId, additionalInfo } = req.body;

    // Check if user can report (not restricted)
    const user = await User.findById(req.user.id);
    if (user.restrictions && user.restrictions.restrictedUntil && new Date() < user.restrictions.restrictedUntil) {
      return res.status(403).json({ 
        error: "You are temporarily restricted from reporting posts",
        restrictedUntil: user.restrictions.restrictedUntil 
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if already deleted
    if (post.isDeleted) {
      return res.status(400).json({ error: "Post has been deleted" });
    }

    // Create report (unique constraint prevents duplicates)
    const report = new PostReport({
      post: postId,
      reportedBy: req.user.id,
      reason: reasonId,
      additionalInfo
    });

    await report.save();

    // Increment report count on post
    post.reportCount = (post.reportCount || 0) + 1;

    // Auto-hide post if 15 or more unique users have reported it
    if (post.reportCount >= 15 && !post.isHidden) {
      post.isHidden = true;
      post.hiddenAt = new Date();

      // Notify post author
      const notification = new Notification({
        user: post.author,
        type: "post_hidden",
        message: "Your post has been hidden due to multiple reports and is under review",
        post: postId
      });
      await notification.save();
    }

    await post.save();

    res.status(201).json({ 
      message: "Post reported successfully",
      reportCount: post.reportCount,
      isHidden: post.isHidden 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "You have already reported this post" });
    }
    console.error("Error reporting post:", error);
    res.status(500).json({ error: "Failed to report post" });
  }
};

// Admin: Get all reported posts
exports.getReportedPosts = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const { status, limit = 20, offset = 0 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Get reports with post details
    const reports = await PostReport.find(query)
      .populate("post")
      .populate("reportedBy", "username profile")
      .populate("reason")
      .populate("reviewedBy", "username")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Group reports by post
    const postReportsMap = {};
    reports.forEach(report => {
      if (!report.post) return; // Skip if post was deleted
      
      const postId = report.post._id.toString();
      if (!postReportsMap[postId]) {
        postReportsMap[postId] = {
          post: report.post,
          reports: [],
          totalReports: 0
        };
      }
      postReportsMap[postId].reports.push(report);
      postReportsMap[postId].totalReports++;
    });

    const reportedPosts = Object.values(postReportsMap);
    const totalCount = await PostReport.countDocuments(query);

    res.json({ 
      reportedPosts,
      totalCount,
      hasMore: offset + limit < totalCount 
    });
  } catch (error) {
    console.error("Error fetching reported posts:", error);
    res.status(500).json({ error: "Failed to fetch reported posts" });
  }
};

// Admin: Get reports for a specific post
exports.getPostReports = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const reports = await PostReport.find({ post: postId })
      .populate("reportedBy", "username profile")
      .populate("reason")
      .populate("reviewedBy", "username")
      .sort({ createdAt: -1 })
      .lean();

    const post = await Post.findById(postId)
      .populate("author", "username profile");

    res.json({ post, reports, totalReports: reports.length });
  } catch (error) {
    console.error("Error fetching post reports:", error);
    res.status(500).json({ error: "Failed to fetch post reports" });
  }
};

// Admin: Review and dismiss reports (restore post)
exports.dismissReports = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reviewNote } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Update all pending reports to dismissed
    await PostReport.updateMany(
      { post: postId, status: 'pending' },
      { 
        status: 'dismissed',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNote 
      }
    );

    // Restore post visibility
    post.isHidden = false;
    post.hiddenAt = null;
    await post.save();

    // Notify post author
    const notification = new Notification({
      user: post.author,
      type: "post_restored",
      message: "Your post has been reviewed and restored",
      post: postId
    });
    await notification.save();

    res.json({ message: "Reports dismissed and post restored successfully" });
  } catch (error) {
    console.error("Error dismissing reports:", error);
    res.status(500).json({ error: "Failed to dismiss reports" });
  }
};

// Admin: Take action on reported post (permanently delete)
exports.deleteReportedPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reviewNote } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Update all pending reports to action_taken
    await PostReport.updateMany(
      { post: postId, status: 'pending' },
      { 
        status: 'action_taken',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNote 
      }
    );

    // Soft delete the post
    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = req.user.id;
    post.isHidden = true;
    await post.save();

    // Notify post author
    const notification = new Notification({
      user: post.author,
      type: "post_deleted",
      message: "Your post has been removed for violating community guidelines",
      post: postId
    });
    await notification.save();

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting reported post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// Admin: Get report statistics
exports.getReportStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const [totalReports, pendingReports, hiddenPosts, deletedPosts] = await Promise.all([
      PostReport.countDocuments(),
      PostReport.countDocuments({ status: 'pending' }),
      Post.countDocuments({ isHidden: true, isDeleted: false }),
      Post.countDocuments({ isDeleted: true })
    ]);

    // Get most reported reasons
    const topReasons = await PostReport.aggregate([
      { $group: { _id: "$reason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Populate reason details
    const ReportReason = require("../models/ReportReason");
    const reasonsWithDetails = await Promise.all(
      topReasons.map(async (item) => {
        const reason = await ReportReason.findById(item._id);
        return {
          reason: reason ? reason.reason : "Unknown",
          count: item.count
        };
      })
    );

    res.json({
      totalReports,
      pendingReports,
      hiddenPosts,
      deletedPosts,
      topReasons: reasonsWithDetails
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({ error: "Failed to fetch report statistics" });
  }
};
