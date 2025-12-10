const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");
const { hashId } = require("../utils/hash"); // Make sure this is imported

// Helper to sync counts
async function syncFollowCounts(userId) {
  const user = await User.findById(userId);
  if (!user) return;
  user.followers = user.followersHashed ? user.followersHashed.length : 0;
  user.following = user.followingHashed ? user.followingHashed.length : 0;
  await user.save();
}

// Get profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("name username email country countryFlag verified createdAt profile gender dateOfBirth");
    
    // Debug: Check for missing required fields
    const missingFields = [];
    if (!user.username) missingFields.push('username');
    if (!user.email) missingFields.push('email');
    if (!user.password) missingFields.push('password');
    if (!user.gender) missingFields.push('gender');
    if (!user.dateOfBirth) missingFields.push('dateOfBirth');
    
    if (missingFields.length > 0) {
      console.warn(`User ${user._id} is missing required fields:`, missingFields);
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Update profile
router.put("/profile", requireAuth, async (req, res) => {
  const { name, username, email, profile } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if nothing has changed
    if (name === user.name && username === user.username && email === user.email && !profile) {
      return res.status(400).json({ message: "No changes to save." });
    }

    // Name validation
    if (name !== undefined) {
      if (!name || name.trim().length < 1) {
        return res.status(400).json({ message: "Name cannot be empty." });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ message: "Name is too long. Maximum 100 characters." });
      }
    }

    // Username validation (same as registration)
    if (username && username !== user.username) {
      const usernameRegex = /^(?!.*[_.]{2})[a-zA-Z0-9](?!.*[_.]{2})[a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/;
      if (
        !usernameRegex.test(username) ||
        username.length < 3 ||
        username.length > 30 ||
        /^\d+$/.test(username) || // cannot be only numbers
        username.includes("@") || // cannot be an email
        username.includes(" ") // cannot contain spaces
      ) {
        return res.status(400).json({
          message:
            "Invalid username. Use 3-30 letters, numbers, underscores, or periods. Cannot be only numbers, start/end with period/underscore, contain '@', or have spaces."
        });
      }
      // Check for existing username (excluding current user)
      const usernameExists = await User.findOne({ 
        username: username, 
        _id: { $ne: req.user.id } 
      });
      if (usernameExists) {
        return res.status(409).json({ message: "Username already taken." });
      }
    }

    // Update fields
    if (name !== undefined) user.name = name.trim();
    user.username = username || user.username;
    user.email = email || user.email;
    if (profile && typeof profile === "object") {
      // Only update allowed profile fields
      user.profile = {
        ...user.profile,
        ...profile,
        // If profileImage and profileImagePublicId are provided, update them
        ...(profile.profileImage && { profileImage: profile.profileImage }),
        ...(profile.profileImagePublicId && { profileImagePublicId: profile.profileImagePublicId })
      };
    }
    await user.save();
    res.json({ 
      message: "Profile updated",
      name: user.name,
      username: user.username, 
      email: user.email,
      profile: user.profile
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: "Failed to update profile",
      error: error.message 
    });
  }
});

// Search users by username or email (case-insensitive, partial match)
router.get("/search", requireAuth, async (req, res) => {
  const q = req.query.q || "";
  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } }
    ]
  })
    .select("username country countryFlag verified") // <-- Add verified here
    .limit(20);
  res.json({ users });
});

// Browse all users with advanced filtering and pagination
router.get("/browse", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      search = '',
      filter = 'recommended',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Cap at 50 users per page
    const skip = (pageNum - 1) * limitNum;

    // Get current user's following list
    const currentUser = await User.findById(userId).select("followingRaw followingHashed country");
    const currentUserFollowing = currentUser?.followingRaw || [];

    console.log(`Debug: filter=${filter}, search="${search}", userId=${userId}`);
    console.log(`Debug: currentUser.country=${currentUser?.country}, followingCount=${currentUserFollowing.length}`);

    // Helper function to check if user has profile image
    const hasProfileImage = (user) => {
      return user.profile && 
             typeof user.profile === 'object' && 
             user.profile.profileImage && 
             user.profile.profileImage.trim() !== '';
    };

    // Helper function to sort users with profile images first
    const sortWithProfileImagePriority = (usersArray) => {
      return usersArray.sort((a, b) => {
        const aHasImage = hasProfileImage(a);
        const bHasImage = hasProfileImage(b);
        
        // Users with profile images come first
        if (aHasImage && !bHasImage) return -1;
        if (!aHasImage && bHasImage) return 1;
        
        // If both have images or both don't have images, sort by followers then by creation date
        if (a.followers !== b.followers) {
          return (b.followers || 0) - (a.followers || 0);
        }
        
        // Then by creation date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    };

    let query = {
      _id: { $ne: userId }, // Exclude current user
    };

    // Add search filter if provided
    if (search.trim()) {
      query.$or = [
        { username: { $regex: search.trim(), $options: "i" } }
      ];
      // When searching, don't exclude followed users - we want to show them too
    } else if (filter !== 'most_followers') {
      // Only exclude followed users when not searching and not viewing popular users
      // For popular users filter, we want to show all popular users regardless of follow status
      query._id = { $ne: userId, $nin: currentUserFollowing };
    }

    let sortOptions = {};
    let users = [];
    let total = 0;

    switch (filter) {
      case 'recommended':
        // If user is searching, bypass complex recommendation logic and do simple search
        if (search.trim()) {
          const searchUsers = await User.find(query)
            .select("_id username verified profile country countryFlag followers createdAt")
            .sort({ followers: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum * 2);

          let searchUsersFormatted = searchUsers.map(user => {
            const userObj = user.toObject();
            if (!userObj.profile) userObj.profile = { profileImage: "" };
            if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
            
            // Check if user is already being followed
            const isFollowed = currentUserFollowing.some(id => String(id) === String(user._id));
            
            return {
              ...userObj,
              reason: 'search_result',
              commonFollower: null,
              isFollowed: isFollowed
            };
          });

          users = sortWithProfileImagePriority(searchUsersFormatted).slice(0, limitNum);
          total = await User.countDocuments(query);
          break;
        }

        // Priority algorithm for recommendations (when not searching):
        // 1. Users followed by people you follow (friends of friends)
        // 2. Users from same country/region  
        // 3. Users with most followers
        // 4. Recent users

        // Get friends of friends first
        if (currentUserFollowing.length > 0) {
          const friendsOfFriends = await User.find({
            _id: { $in: currentUserFollowing }
          }).select("followingRaw username profile verified");

          const potentialSuggestions = new Set();
          const commonFollowers = {};

          for (const friend of friendsOfFriends) {
            if (friend.followingRaw && friend.followingRaw.length > 0) {
              for (const suggestedUserId of friend.followingRaw) {
                if (String(suggestedUserId) === String(userId) || 
                    currentUserFollowing.some(id => String(id) === String(suggestedUserId))) {
                  continue;
                }
                potentialSuggestions.add(String(suggestedUserId));
                if (!commonFollowers[suggestedUserId]) {
                  commonFollowers[suggestedUserId] = friend;
                }
              }
            }
          }

          // Get mutual following suggestions
          if (potentialSuggestions.size > 0) {
            const mutualQuery = { 
              ...query,
              _id: { 
                ...query._id,
                $in: Array.from(potentialSuggestions)
              }
            };

            const mutualUsers = await User.find(mutualQuery)
              .select("_id username verified profile country countryFlag followers createdAt")
              .limit(limitNum * 2); // Get more to allow for better sorting

            let mutualUsersFormatted = mutualUsers.map(user => {
              const userObj = user.toObject();
              if (!userObj.profile) userObj.profile = { profileImage: "" };
              if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
              
              // Check if user is already being followed (should be false for recommendations, but good to be explicit)
              const isFollowed = currentUserFollowing.some(id => String(id) === String(user._id));
              
              return {
                ...userObj,
                reason: 'mutual_following',
                commonFollower: commonFollowers[user._id] ? {
                  _id: commonFollowers[user._id]._id,
                  username: commonFollowers[user._id].username,
                  profile: commonFollowers[user._id].profile,
                  verified: commonFollowers[user._id].verified
                } : null,
                isFollowed: isFollowed
              };
            });

            // Sort with profile image priority
            mutualUsersFormatted = sortWithProfileImagePriority(mutualUsersFormatted);
            users = mutualUsersFormatted.slice(0, limitNum);
          }
        }

        // If we need more users, add same country users
        if (users.length < limitNum && currentUser.country) {
          const remainingLimit = limitNum - users.length;
          const existingIds = users.map(u => u._id);
          
          const countryQuery = {
            ...query,
            country: currentUser.country,
            _id: { 
              ...query._id,
              $nin: [...currentUserFollowing, ...existingIds]
            }
          };

          const countryUsers = await User.find(countryQuery)
            .select("_id username verified profile country countryFlag followers createdAt")
            .limit(remainingLimit * 2); // Get more to allow for better sorting

          let countryUsersFormatted = countryUsers.map(user => {
            const userObj = user.toObject();
            if (!userObj.profile) userObj.profile = { profileImage: "" };
            if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
            
            // Check if user is already being followed (should be false for recommendations, but good to be explicit)
            const isFollowed = currentUserFollowing.some(id => String(id) === String(user._id));
            
            return {
              ...userObj,
              reason: 'same_country',
              commonFollower: null,
              isFollowed: isFollowed
            };
          });

          // Sort with profile image priority
          countryUsersFormatted = sortWithProfileImagePriority(countryUsersFormatted);
          users = [...users, ...countryUsersFormatted.slice(0, remainingLimit)];
        }

        // If still need more users, add popular users (above average followers)
        if (users.length < limitNum) {
          const remainingLimit = limitNum - users.length;
          const existingIds = users.map(u => u._id);
          
          // Calculate average followers to determine what "popular" means
          const avgFollowersResult = await User.aggregate([
            { $group: { _id: null, avgFollowers: { $avg: "$followers" } } }
          ]);
          const avgFollowers = avgFollowersResult.length > 0 ? avgFollowersResult[0].avgFollowers : 0;
          
          const popularQuery = {
            ...query,
            _id: { 
              ...query._id,
              $nin: [...currentUserFollowing, ...existingIds]
            },
            followers: { $gte: Math.max(1, Math.ceil(avgFollowers)) } // Only users with above-average followers
          };

          const popularUsers = await User.find(popularQuery)
            .select("_id username verified profile country countryFlag followers createdAt")
            .sort({ followers: -1, createdAt: -1 }) // Sort by followers descending
            .skip(skip)
            .limit(remainingLimit * 2); // Get more to allow for better sorting

          let popularUsersFormatted = popularUsers.map(user => {
            const userObj = user.toObject();
            if (!userObj.profile) userObj.profile = { profileImage: "" };
            if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
            
            // Check if user is already being followed
            const isFollowed = currentUserFollowing.some(id => String(id) === String(user._id));
            
            return {
              ...userObj,
              reason: users.length > 0 ? 'popular' : 'random',
              commonFollower: null,
              isFollowed: isFollowed
            };
          });

          // Sort with profile image priority
          popularUsersFormatted = sortWithProfileImagePriority(popularUsersFormatted);
          users = [...users, ...popularUsersFormatted.slice(0, remainingLimit)];
        }

        // Get total for pagination
        if (!search.trim()) {
          total = await User.countDocuments({
            ...query,
            _id: { $ne: userId, $nin: currentUserFollowing }
          });
        }
        // Note: total is already set above for search queries
        break;

      case 'most_followers':
        // Calculate average followers to determine what "popular" means
        const avgFollowersResult = await User.aggregate([
          { $group: { _id: null, avgFollowers: { $avg: "$followers" } } }
        ]);
        const avgFollowers = avgFollowersResult.length > 0 ? avgFollowersResult[0].avgFollowers : 0;
        
        // Add follower requirement but keep existing _id filter
        query.followers = { $gte: Math.max(1, Math.ceil(avgFollowers)) }; // At least average, minimum of 1
        sortOptions = { followers: -1, createdAt: -1 };
        break;

      case 'same_region':
        if (currentUser.country) {
          query.country = currentUser.country;
          // Keep existing _id filter, just add country requirement
        }
        sortOptions = { followers: -1, createdAt: -1 };
        break;

      case 'recent':
        // Keep existing _id filter, just set sort options
        sortOptions = { createdAt: -1 };
        break;

      default:
        // Keep existing _id filter, just set sort options
        sortOptions = { createdAt: -1 };
    }

    // For non-recommended filters, use standard query with profile image priority
    if (filter !== 'recommended') {
      console.log(`Debug: Executing query for filter=${filter}:`, JSON.stringify(query, null, 2));
      console.log(`Debug: Sort options:`, sortOptions);
      
      const foundUsers = await User.find(query)
        .select("_id username verified profile country countryFlag followers createdAt")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum * 2); // Get more to allow for better sorting

      console.log(`Debug: Found ${foundUsers.length} users for filter=${filter}`);

      let usersFormatted = foundUsers.map(user => {
        const userObj = user.toObject();
        if (!userObj.profile) userObj.profile = { profileImage: "" };
        if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
        
        // Check if user is already being followed
        const isFollowed = currentUserFollowing.some(id => String(id) === String(user._id));
        
        return {
          ...userObj,
          reason: search.trim() ? 'search_result' : 
                 filter === 'most_followers' ? 'most_followers' : 
                 filter === 'same_region' ? 'same_country' : 'recent',
          commonFollower: null,
          isFollowed: isFollowed
        };
      });

      // Sort with profile image priority
      users = sortWithProfileImagePriority(usersFormatted).slice(0, limitNum);

      total = await User.countDocuments(query);
    }

    const hasMore = (pageNum * limitNum) < total;

    res.json({
      users,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore,
      filter
    });

  } catch (error) {
    console.error("Error browsing users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Follow a user
router.post("/follow/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const targetId = req.params.id;

  if (userId === targetId) {
    return res.status(400).json({ message: "You cannot follow yourself." });
  }

  const user = await User.findById(userId);
  const target = await User.findById(targetId);

  if (!user || !target) {
    return res.status(404).json({ message: "User not found." });
  }

  const hashedUserId = hashId(userId);
  const hashedTargetId = hashId(targetId);

  if (target.followersHashed.includes(hashedUserId)) {
    return res.status(400).json({ message: "Already following." });
  }

  await User.findByIdAndUpdate(targetId, {
    $push: { followersHashed: hashedUserId }
  });
  await User.findByIdAndUpdate(userId, {
    $push: { followingHashed: hashedTargetId, followingRaw: target._id }
  });

  // Sync counts for both users
  await syncFollowCounts(targetId);
  await syncFollowCounts(userId);

  // After successful follow:
  // Create notification for the followed user
  await Notification.create({
    user: targetId,
    type: "follow",
   message:`${user.username} followed you`,
    from: userId,
    read: false,
  });

  res.json({ message: "Followed", userId: targetId });
});

// Unfollow a user
router.post("/unfollow/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const targetId = req.params.id;

  if (userId === targetId) {
    return res.status(400).json({ message: "You cannot unfollow yourself." });
  }

  const user = await User.findById(userId);
  const target = await User.findById(targetId);

  if (!user || !target) {
    return res.status(404).json({ message: "User not found." });
  }

  const hashedUserId = hashId(userId);
  const hashedTargetId = hashId(targetId);

  if (!target.followersHashed.includes(hashedUserId)) {
    return res.status(400).json({ message: "You are not following this user." });
  }

  await User.findByIdAndUpdate(targetId, {
    $pull: { followersHashed: hashedUserId }
  });
  await User.findByIdAndUpdate(userId, {
    $pull: { followingHashed: hashedTargetId, followingRaw: target._id }
  });

  // Sync counts for both users
  await syncFollowCounts(targetId);
  await syncFollowCounts(userId);

  res.json({ message: "Unfollowed", userId: targetId });
});

// Get public profile by username
router.get("/public/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username })
    .select("_id username country countryFlag createdAt followers following verified profile followersHashed");
  const followingRaw = user.followingRaw || [];

  res.json({
    _id: user._id,
    username: user.username,
    country: user.country,
    countryFlag: user.countryFlag,
    joined: user.createdAt,
    followers: user.followers || 0,
    following: user.following || 0,
    verified: user.verified || false,
    profile: user.profile || {},
    followersHashed: user.followersHashed || [],
  });
});

// Followers List
router.get("/followers/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedId = hashId(user._id.toString());

  // Find all users whose followingHashed contains this user's hashed ID
  const followers = await User.find({ followingHashed: hashedId })
    .select("username country countryFlag _id verified profile.profileImage");
  res.json({ followers });
});

// Followers Search
router.get("/followers/:username/search", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedId = hashId(user._id.toString());
  const q = req.query.q || "";
  if (!q) return res.json({ followers: [] });

  // Find users who follow this user and match the search query
  const followers = await User.find({
    followingHashed: hashedId,
    username: { $regex: q, $options: "i" }
  }).select("username country countryFlag _id verified profile.profileImage");
  res.json({ followers });
});

// Following List
router.get("/following/:username", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const followingRaw = user.followingRaw || [];
  if (!followingRaw.length) return res.json({ following: [] });

  const following = await User.find({
    _id: { $in: followingRaw }
  }).select("username country countryFlag _id verified profile.profileImage");
  res.json({ following });
});

// Following Search
router.get("/following/:username/search", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const followingHashed = user.followingHashed || [];
  const q = req.query.q || "";
  if (!q) return res.json({ following: [] });

  const following = await User.find({
    followersHashed: { $in: followingHashed },
    username: { $regex: q, $options: "i" }
  })
    .limit(80)
    .select("username country countryFlag _id verified"); // <-- Add verified here
  res.json({ following });
});

// Delete user and update followers/following counts
router.delete("/delete/:id", requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  // Get the hashed ID of the user to be deleted
  const hashedId = hashId(user._id.toString());

  // 1. Remove this user from followersHashed/followersRaw/followingHashed/followingRaw of others
  // 2. Decrement followers count for users this user was following
  if (user.followingHashed && user.followingHashed.length > 0) {
    await User.updateMany(
      { followersHashed: { $in: [hashedId] } },
      {
        $pull: { followersHashed: hashedId, followersRaw: user._id },
        $inc: { followers: -1 }
      }
    );
  }

  // 3. Decrement following count for users who were following this user
  if (user.followersHashed && user.followersHashed.length > 0) {
    await User.updateMany(
      { followingHashed: { $in: [hashedId] } },
      {
        $pull: { followingHashed: hashedId, followingRaw: user._id },
        $inc: { following: -1 }
      }
    );
  }

  // 4. Decrement followers count for all users the deleted user was following
  if (user.followingRaw && user.followingRaw.length > 0) {
    await User.updateMany(
      { _id: { $in: user.followingRaw } },
      {
        $inc: { followers: -1 },
        $pull: { followersHashed: hashedId, followersRaw: user._id }
      }
    );
  }

  // 5. Optionally, remove this user from any other custom arrays

  // 6. Delete the user
  await user.deleteOne();

  res.json({ message: "User deleted and relationships cleaned up." });
});

// Get notifications for logged-in user
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "from",
        select: "username verified profile.profileImage",
      })
      .lean();

    // For each notification, flatten the profileImage to top-level for easier frontend access
    const notificationsWithProfileImage = notifications.map(n => {
      let profileImage = '';
      if (n.from && n.from.profile && n.from.profile.profileImage) {
        profileImage = n.from.profile.profileImage;
      }
      return {
        ...n,
        profileImage,
        username: n.from?.username,
        verified: n.from?.verified,
      };
    });
    res.json(notificationsWithProfileImage);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get unread notification count
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user.id, read: false });
  res.json({ count });
});

// Mark all notifications as read
router.post("/notifications/mark-read", requireAuth, async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

// Get last seen for a user
router.get("/last-seen/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("lastSeen");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ lastSeen: user.lastSeen });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get profile images for a list of usernames or user IDs
router.post("/profile-images", async (req, res) => {
  try {
    const { userIds, usernames } = req.body;
    let query = {};
    if (Array.isArray(userIds) && userIds.length > 0) {
      query._id = { $in: userIds };
    } else if (Array.isArray(usernames) && usernames.length > 0) {
      query.username = { $in: usernames };
    } else {
      return res.status(400).json({ message: "Provide userIds or usernames array." });
    }
    const users = await User.find(query).select("_id profile.profileImage").lean();
    // Build mapping: { userId: profileImageUrl }
    const images = {};
    users.forEach(u => {
      images[u._id] = u.profile?.profileImage || null;
    });
    res.json({ images });
  } catch (err) {
    console.error("Error fetching profile images:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get profile suggestions for a user
router.get("/suggestions/:userId", requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUser = await User.findById(userId).select("followingHashed followingRaw country");
    
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const suggestions = [];
    const maxSuggestions = 15; // Increased to provide more options for frontend filtering
    const currentUserFollowing = currentUser.followingRaw || [];
    const currentUserFollowingHashed = currentUser.followingHashed || [];

    // Strategy 1: Find users followed by people the current user follows (friends of friends)
    if (currentUserFollowing.length > 0) {
      // Get users that the current user's following are following
      const friendsOfFriends = await User.find({
        _id: { $in: currentUserFollowing }
      }).select("followingRaw username profile verified");

      const potentialSuggestions = new Set();
      const commonFollowers = {};

      for (const friend of friendsOfFriends) {
        if (friend.followingRaw && friend.followingRaw.length > 0) {
          for (const suggestedUserId of friend.followingRaw) {
            // Skip if it's the current user or already following
            if (String(suggestedUserId) === String(userId) || 
                currentUserFollowing.some(id => String(id) === String(suggestedUserId))) {
              continue;
            }
            
            potentialSuggestions.add(String(suggestedUserId));
            
            // Track who the common follower is
            if (!commonFollowers[suggestedUserId]) {
              commonFollowers[suggestedUserId] = friend;
            }
          }
        }
      }

      // Get detailed info for these suggestions
      if (potentialSuggestions.size > 0) {
        const suggestedUsers = await User.find({
          _id: { $in: Array.from(potentialSuggestions) }
        }).select("_id username verified profile country countryFlag").limit(8);

        for (const user of suggestedUsers) {
          const userObj = user.toObject();
          // Ensure profile structure is consistent
          if (!userObj.profile) userObj.profile = { profileImage: "" };
          if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
          
          suggestions.push({
            ...userObj,
            commonFollower: commonFollowers[user._id] ? {
              _id: commonFollowers[user._id]._id,
              username: commonFollowers[user._id].username,
              profile: commonFollowers[user._id].profile,
              verified: commonFollowers[user._id].verified
            } : null,
            reason: 'mutual_following'
          });
        }
      }
    }

    // Strategy 2: If we don't have enough suggestions, find users from the same country
    if (suggestions.length < maxSuggestions && currentUser.country) {
      const countryUsers = await User.find({
        country: currentUser.country,
        _id: { 
          $ne: userId,
          $nin: [...currentUserFollowing, ...suggestions.map(s => s._id)]
        }
      }).select("_id username verified profile country countryFlag")
        .limit(maxSuggestions - suggestions.length);

      for (const user of countryUsers) {
        const userObj = user.toObject();
        // Ensure profile structure is consistent
        if (!userObj.profile) userObj.profile = { profileImage: "" };
        if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
        
        suggestions.push({
          ...userObj,
          commonFollower: null,
          reason: 'same_country'
        });
      }
    }

    // Strategy 3: If still not enough, get random active users
    if (suggestions.length < maxSuggestions) {
      const randomUsers = await User.find({
        _id: { 
          $ne: userId,
          $nin: [...currentUserFollowing, ...suggestions.map(s => s._id)]
        }
      }).select("_id username verified profile country countryFlag")
        .limit(maxSuggestions - suggestions.length)
        .sort({ createdAt: -1 }); // Get recent users

      for (const user of randomUsers) {
        const userObj = user.toObject();
        // Ensure profile structure is consistent
        if (!userObj.profile) userObj.profile = { profileImage: "" };
        if (!userObj.profile.profileImage) userObj.profile.profileImage = "";
        
        suggestions.push({
          ...userObj,
          commonFollower: null,
          reason: 'random'
        });
      }
    }

    res.json({ 
      suggestions: suggestions.slice(0, maxSuggestions),
      total: suggestions.length 
    });

  } catch (err) {
    console.error("Error getting profile suggestions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Save Expo push token for current user
router.put('/expo-push-token', requireAuth, async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken) return res.status(400).json({ error: 'No Expo push token provided' });
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.expoPushToken = expoPushToken;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving Expo push token:', err);
    res.status(500).json({ error: 'Failed to save Expo push token', details: err?.message || err });
  }
});

module.exports = router;