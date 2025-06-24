const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Follow = require("../models/Follow");
const { requireAuth } = require("../middleware/auth");
const { hashId } = require("../utils/hash");

// Get profile
router.get("/profile", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const follow = await Follow.findOne({ user: user._id });
  res.json({
    username: user.username,
    email: user.email,
    joined: user.createdAt,
    followers: user.followers || 0,
    following: user.following || 0,
    followersHashed: follow ? follow.followersHashed : [],
    followingHashed: follow ? follow.followingHashed : [],
    country: user.country,
    countryFlag: user.countryFlag,
  });
});

// Update profile
router.put("/profile", requireAuth, async (req, res) => {
  const { username, email } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.username = username || user.username;
  user.email = email || user.email;
  await user.save();
  res.json({ message: "Profile updated", username: user.username, email: user.email });
});

// Search users by username or email (case-insensitive, partial match)
router.get("/search", requireAuth, async (req, res) => {
  const q = req.query.q || "";
  if (!q) return res.json({ users: [] });
  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } }
    ]
  })
    .limit(10)
    .select("username country countryFlag _id"); // Only return username, country, countryFlag, _id
  res.json({ users });
});

// Follow a user
router.post("/follow/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const targetId = req.params.id;

  // Prevent following yourself
  if (userId === targetId) {
    return res.status(400).json({ message: "You cannot follow yourself." });
  }

  const userFollow = await Follow.findOne({ user: userId });
  const targetFollow = await Follow.findOne({ user: targetId });
  if (!userFollow || !targetFollow) return res.status(404).json({ message: "User not found" });

  // Prevent duplicate follows
  if (userFollow.following.includes(targetId)) {
    return res.status(400).json({ message: "Already following" });
  }

  userFollow.following.push(targetId);
  userFollow.followingHashed.push(hashId(targetId));
  userFollow.followingCount += 1;

  targetFollow.followers.push(userId);
  targetFollow.followersHashed.push(hashId(userId));
  targetFollow.followersCount += 1;

  await userFollow.save();
  await targetFollow.save();

  // Update User collection
  await User.findByIdAndUpdate(userId, { $inc: { following: 1 } });
  await User.findByIdAndUpdate(targetId, { $inc: { followers: 1 } });

  res.json({ message: "Followed", userId: targetId });
});

// Unfollow a user
router.post("/unfollow/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const targetId = req.params.id;

  if (userId === targetId) {
    return res.status(400).json({ message: "You cannot unfollow yourself." });
  }

  const userFollow = await Follow.findOne({ user: userId });
  const targetFollow = await Follow.findOne({ user: targetId });
  if (!userFollow || !targetFollow) return res.status(404).json({ message: "User not found" });

  // Only unfollow if currently following
  const followingIndex = userFollow.following.findIndex(id => id.equals(targetId));
  const followingHash = hashId(targetId);
  const followingHashedIndex = userFollow.followingHashed.indexOf(followingHash);

  if (followingIndex !== -1) {
    userFollow.following.splice(followingIndex, 1);
    userFollow.followingCount = Math.max(0, userFollow.followingCount - 1);
  }
  if (followingHashedIndex !== -1) {
    userFollow.followingHashed.splice(followingHashedIndex, 1);
  }

  const followerIndex = targetFollow.followers.findIndex(id => id.equals(userId));
  const followerHash = hashId(userId);
  const followersHashedIndex = targetFollow.followersHashed.indexOf(followerHash);

  if (followerIndex !== -1) {
    targetFollow.followers.splice(followerIndex, 1);
    targetFollow.followersCount = Math.max(0, targetFollow.followersCount - 1);
  }
  if (followersHashedIndex !== -1) {
    targetFollow.followersHashed.splice(followersHashedIndex, 1);
  }

  await userFollow.save();
  await targetFollow.save();

  // Update User collection
  await User.findByIdAndUpdate(userId, { $inc: { following: -1 } });
  await User.findByIdAndUpdate(targetId, { $inc: { followers: -1 } });

  res.json({ message: "Unfollowed", userId: targetId });
});

// Get public profile by username (with follower/following counts)
router.get("/public/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });
  const follow = await Follow.findOne({ user: user._id });
  res.json({
    username: user.username,
    followers: follow ? follow.followersCount : 0,
    following: follow ? follow.followingCount : 0,
    joined: user.createdAt,
    country: user.country,
    countryFlag: user.countryFlag,
  });
});

// Get followers list for a user by username, paginated
router.get("/followers/:username", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 80;
  const skip = (page - 1) * limit;

  const follow = await Follow.findOne({ user: user._id })
    .populate({
      path: "followers",
      select: "username country countryFlag _id",
      options: { skip, limit }
    });

  if (!follow) return res.json({ followers: [] });

  res.json({
    followers: follow.followers.map(u => ({
      _id: u._id,
      username: u.username,
      country: u.country,
      countryFlag: u.countryFlag
    }))
  });
});

// Search a user's followers by username (case-insensitive, partial match)
router.get("/followers/:username/search", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const q = req.query.q || "";
  if (!q) return res.json({ followers: [] });

  // Find the Follow document for this user
  const follow = await Follow.findOne({ user: user._id });
  if (!follow || !follow.followers.length) return res.json({ followers: [] });

  // Search for followers whose username matches q
  const followers = await User.find({
    _id: { $in: follow.followers },
    username: { $regex: q, $options: "i" }
  }).select("username country countryFlag _id");

  res.json({ followers });
});

// Get following list for a user by username, paginated
router.get("/following/:username", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 80;
  const skip = (page - 1) * limit;

  const follow = await Follow.findOne({ user: user._id })
    .populate({
      path: "following",
      select: "username country countryFlag _id",
      options: { skip, limit }
    });

  if (!follow) return res.json({ following: [] });

  res.json({
    following: follow.following.map(u => ({
      _id: u._id,
      username: u.username,
      country: u.country,
      countryFlag: u.countryFlag
    }))
  });
});

// Search a user's following by username (case-insensitive, partial match, max 80)
router.get("/following/:username/search", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const q = req.query.q || "";
  if (!q) return res.json({ following: [] });

  const follow = await Follow.findOne({ user: user._id });
  if (!follow || !follow.following.length) return res.json({ following: [] });

  const following = await User.find({
    _id: { $in: follow.following },
    username: { $regex: q, $options: "i" }
  })
    .limit(80)
    .select("username country countryFlag _id");

  res.json({ following });
});

module.exports = router;