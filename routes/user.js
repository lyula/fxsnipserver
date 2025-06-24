const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Follow = require("../models/Follow");
const { requireAuth } = require("../middleware/auth");

// Get profile
router.get("/profile", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    username: user.username,
    email: user.email,
    joined: user.createdAt,
    followers: user.followers || 0,
    following: user.following || 0,
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

// Follow a user (prevents duplicates and self-follow)
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
  userFollow.followingCount += 1;
  targetFollow.followers.push(userId);
  targetFollow.followersCount += 1;

  await userFollow.save();
  await targetFollow.save();

  res.json({ message: "Followed", userId: targetId });
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

module.exports = router;