const express = require("express");
const router = express.Router();
const User = require("../models/User");
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
  const user = await User.findById(req.user.id)
    .select("username email country countryFlag verified"); // <-- Add verified here
  res.json(user);
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
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    _id: user._id,
    username: user.username,
    country: user.country,
    countryFlag: user.countryFlag,
    joined: user.createdAt,
    followers: user.followers || 0,
    following: user.following || 0,
    verified: user.verified || false,
    followersHashed: user.followersHashed || [], // <-- THIS IS REQUIRED
  });
});

// Followers List
router.get("/followers/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const hashedId = hashId(user._id.toString());

  // Find all users whose followingHashed contains this user's hashed ID
  const followers = await User.find({ followingHashed: hashedId })
    .select("username country countryFlag _id verified"); // <-- Add verified here
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
  }).select("username country countryFlag _id verified"); // <-- Add verified here
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
  }).select("username country countryFlag _id verified"); // <-- Add verified here
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

module.exports = router;