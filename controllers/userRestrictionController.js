const User = require("../models/User");
const Notification = require("../models/Notification");

// Admin: Restrict user activities
exports.restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      canCreatePosts, 
      canLikePosts, 
      canComment, 
      canFollow, 
      canMessage, 
      canShare,
      restrictedUntil,
      restrictionReason 
    } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent restricting other admins
    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Cannot restrict admin users" });
    }

    // Update restrictions
    user.restrictions = {
      canCreatePosts: canCreatePosts !== undefined ? canCreatePosts : true,
      canLikePosts: canLikePosts !== undefined ? canLikePosts : true,
      canComment: canComment !== undefined ? canComment : true,
      canFollow: canFollow !== undefined ? canFollow : true,
      canMessage: canMessage !== undefined ? canMessage : true,
      canShare: canShare !== undefined ? canShare : true,
      restrictedUntil: restrictedUntil ? new Date(restrictedUntil) : null,
      restrictionReason,
      restrictedBy: req.user.id,
      restrictedAt: new Date()
    };

    await user.save();

    // Notify user about restrictions
    const restrictionsList = [];
    if (!canCreatePosts) restrictionsList.push("creating posts");
    if (!canLikePosts) restrictionsList.push("liking posts");
    if (!canComment) restrictionsList.push("commenting");
    if (!canFollow) restrictionsList.push("following users");
    if (!canMessage) restrictionsList.push("sending messages");
    if (!canShare) restrictionsList.push("sharing posts");

    const restrictionsText = restrictionsList.join(", ");
    const notification = new Notification({
      user: userId,
      type: "account_restricted",
      message: `Your account has been restricted from: ${restrictionsText}. ${restrictionReason || ''}`,
    });
    await notification.save();

    res.json({ 
      message: "User restrictions updated successfully",
      restrictions: user.restrictions 
    });
  } catch (error) {
    console.error("Error restricting user:", error);
    res.status(500).json({ error: "Failed to restrict user" });
  }
};

// Admin: Remove all restrictions from user
exports.unrestrictUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Reset all restrictions
    user.restrictions = {
      canCreatePosts: true,
      canLikePosts: true,
      canComment: true,
      canFollow: true,
      canMessage: true,
      canShare: true,
      restrictedUntil: null,
      restrictionReason: null,
      restrictedBy: null,
      restrictedAt: null
    };

    await user.save();

    // Notify user
    const notification = new Notification({
      user: userId,
      type: "account_unrestricted",
      message: "Your account restrictions have been lifted. You can now use all features normally.",
    });
    await notification.save();

    res.json({ message: "User restrictions removed successfully" });
  } catch (error) {
    console.error("Error unrestricting user:", error);
    res.status(500).json({ error: "Failed to unrestrict user" });
  }
};

// Admin: Get user restriction status
exports.getUserRestrictions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is admin or the user themselves
    if (req.user.role !== 'admin' && req.user.role !== 'moderator' && req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId)
      .select("username restrictions")
      .populate("restrictions.restrictedBy", "username");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ 
      username: user.username,
      restrictions: user.restrictions || {
        canCreatePosts: true,
        canLikePosts: true,
        canComment: true,
        canFollow: true,
        canMessage: true,
        canShare: true
      }
    });
  } catch (error) {
    console.error("Error fetching user restrictions:", error);
    res.status(500).json({ error: "Failed to fetch user restrictions" });
  }
};

// Admin: Get all restricted users
exports.getRestrictedUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const { limit = 20, offset = 0 } = req.query;

    // Find users with active restrictions
    const users = await User.find({
      $or: [
        { 'restrictions.canCreatePosts': false },
        { 'restrictions.canLikePosts': false },
        { 'restrictions.canComment': false },
        { 'restrictions.canFollow': false },
        { 'restrictions.canMessage': false },
        { 'restrictions.canShare': false },
        { 
          'restrictions.restrictedUntil': { $gte: new Date() } 
        }
      ]
    })
    .select("username profile restrictions")
    .populate("restrictions.restrictedBy", "username")
    .sort({ 'restrictions.restrictedAt': -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .lean();

    const totalCount = await User.countDocuments({
      $or: [
        { 'restrictions.canCreatePosts': false },
        { 'restrictions.canLikePosts': false },
        { 'restrictions.canComment': false },
        { 'restrictions.canFollow': false },
        { 'restrictions.canMessage': false },
        { 'restrictions.canShare': false },
        { 
          'restrictions.restrictedUntil': { $gte: new Date() } 
        }
      ]
    });

    res.json({ 
      users,
      totalCount,
      hasMore: offset + limit < totalCount 
    });
  } catch (error) {
    console.error("Error fetching restricted users:", error);
    res.status(500).json({ error: "Failed to fetch restricted users" });
  }
};

// User: Check own restriction status
exports.checkMyRestrictions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("restrictions");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if temporary restriction has expired
    if (user.restrictions && user.restrictions.restrictedUntil && new Date() >= user.restrictions.restrictedUntil) {
      // Auto-remove expired restrictions
      user.restrictions = {
        canCreatePosts: true,
        canLikePosts: true,
        canComment: true,
        canFollow: true,
        canMessage: true,
        canShare: true,
        restrictedUntil: null,
        restrictionReason: null
      };
      await user.save();
    }

    res.json({ 
      restrictions: user.restrictions || {
        canCreatePosts: true,
        canLikePosts: true,
        canComment: true,
        canFollow: true,
        canMessage: true,
        canShare: true
      }
    });
  } catch (error) {
    console.error("Error checking restrictions:", error);
    res.status(500).json({ error: "Failed to check restrictions" });
  }
};
