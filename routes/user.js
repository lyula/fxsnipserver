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

  // Prevent duplicate follows
  if (target.followersHashed.includes(hashedUserId)) {
    return res.status(400).json({ message: "Already following." });
  }

  // Add hashed IDs to arrays and increment counts
  await User.findByIdAndUpdate(targetId, {
    $inc: { followers: 1 },
    $push: { followersHashed: hashedUserId }
  });
  await User.findByIdAndUpdate(userId, {
    $inc: { following: 1 },
    $push: { followingHashed: hashedTargetId }
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

  // Only unfollow if currently following
  if (!target.followersHashed.includes(hashedUserId)) {
    return res.status(400).json({ message: "You are not following this user." });
  }

  // Remove hashed IDs from arrays and decrement counts
  await User.findByIdAndUpdate(targetId, {
    $inc: { followers: -1 },
    $pull: { followersHashed: hashedUserId }
  });
  await User.findByIdAndUpdate(userId, {
    $inc: { following: -1 },
    $pull: { followingHashed: hashedTargetId }
  });

  res.json({ message: "Unfollowed", userId: targetId });
});

// Get public profile by username (with follower/following counts)
router.get("/public/:username", async (req, res) => {
  const user = await require("../models/User").findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    username: user.username,
    country: user.country,
    countryFlag: user.countryFlag,
    joined: user.createdAt,
    followers: user.followers || 0,
    following: user.following || 0,
    // add other public fields if needed
  });
});

// Get followers list for a user by username, public access
router.get("/followers/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedId = hashId(user._id.toString());

  // Find all users whose followingHashed contains this user's hashed ID
  const followers = await User.find({ followingHashed: hashedId })
    .select("username country countryFlag _id");

  res.json({ followers });
});

// Search a user's followers by username (case-insensitive, partial match)
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
  }).select("username country countryFlag _id");

  res.json({ followers });
});

// Get following list for a user by username, paginated
router.get("/following/:username", requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  // Find all users whose followersHashed contains any of this user's followingHashed
  const followingHashed = user.followingHashed || [];
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 80;
  const skip = (page - 1) * limit;

  const following = await User.find({
    followersHashed: { $in: followingHashed }
  })
    .skip(skip)
    .limit(limit)
    .select("username country countryFlag _id");

  res.json({ following });
});

// Search a user's following by username (case-insensitive, partial match, max 80)
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
    .select("username country countryFlag _id");

  res.json({ following });
});

module.exports = router;