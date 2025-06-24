const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token" });
  try {
    const token = auth.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

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
    .select("username email country countryFlag followers following _id");
  res.json({ users });
});

// Follow a user
router.post("/follow/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const targetId = req.params.id;
  if (userId === targetId) return res.status(400).json({ message: "Cannot follow yourself" });

  // Add logic to prevent duplicate follows (optional: use a Follows collection for scalability)
  const user = await User.findById(userId);
  const target = await User.findById(targetId);
  if (!user || !target) return res.status(404).json({ message: "User not found" });

  // For demo: just increment counters (replace with real follow logic in production)
  user.following = (user.following || 0) + 1;
  target.followers = (target.followers || 0) + 1;
  await user.save();
  await target.save();

  res.json({ message: "Followed", userId: targetId });
});

// Get public profile by username
router.get("/public/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    username: user.username,
    followers: user.followers || 0,
    following: user.following || 0,
    joined: user.createdAt,
    country: user.country,
    countryFlag: user.countryFlag,
    // Add avatar if you have it in your schema
  });
});

module.exports = router;