const User = require("../models/User");

// Middleware to check if user has specific activity permissions
const checkRestriction = (activityType) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select("restrictions");
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If no restrictions set, allow all activities
      if (!user.restrictions) {
        return next();
      }

      // Check if temporary restriction has expired
      if (user.restrictions.restrictedUntil && new Date() >= user.restrictions.restrictedUntil) {
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
        return next();
      }

      // Check specific activity permission
      const permissionMap = {
        'createPost': 'canCreatePosts',
        'likePost': 'canLikePosts',
        'comment': 'canComment',
        'follow': 'canFollow',
        'message': 'canMessage',
        'share': 'canShare'
      };

      const permissionField = permissionMap[activityType];
      
      if (!permissionField) {
        return next(); // Unknown activity type, allow by default
      }

      if (user.restrictions[permissionField] === false) {
        const activityNames = {
          'createPost': 'create posts',
          'likePost': 'like posts',
          'comment': 'comment on posts',
          'follow': 'follow users',
          'message': 'send messages',
          'share': 'share posts'
        };

        return res.status(403).json({ 
          error: `You are restricted from ${activityNames[activityType]}`,
          restrictedUntil: user.restrictions.restrictedUntil,
          reason: user.restrictions.restrictionReason
        });
      }

      next();
    } catch (error) {
      console.error("Error checking restrictions:", error);
      res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
};

// Export restriction checkers for different activities
module.exports = {
  canCreatePost: checkRestriction('createPost'),
  canLikePost: checkRestriction('likePost'),
  canComment: checkRestriction('comment'),
  canFollow: checkRestriction('follow'),
  canMessage: checkRestriction('message'),
  canShare: checkRestriction('share')
};
