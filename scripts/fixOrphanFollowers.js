/**
 * Script to clean up orphaned followers/following references and decrement follower/following counts
 * for users who have deleted users in their followers/following arrays.
 *
 * Instructions:
 * 1. Ensure your .env file has MONGO_URI set (not MONGODB_URI).
 * 2. Run: node scripts/fixOrphanFollowers.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { hashId } = require("../utils/hash");

async function fixOrphanFollowersAndFollowings() {
  // 1. Get all valid user IDs as strings
  const allUsers = await User.find({}, "_id");
  const validUserIds = new Set(allUsers.map(u => u._id.toString()));
  const validHashes = new Set([...validUserIds].map(id => hashId(id)));

  // 2. For each user, check all four arrays for non-existing users
  const users = await User.find({});
  let totalFixed = 0;

  for (const user of users) {
    let changed = false;

    // followersRaw: remove any ObjectId not in validUserIds
    const originalFollowersRaw = user.followersRaw || [];
    const filteredFollowersRaw = originalFollowersRaw.filter(id => validUserIds.has(id.toString()));
    const removedFollowersRaw = originalFollowersRaw.length - filteredFollowersRaw.length;

    // followersHashed: remove any hash not in validHashes
    const originalFollowersHashed = user.followersHashed || [];
    const filteredFollowersHashed = originalFollowersHashed.filter(hash => validHashes.has(hash));
    const removedFollowersHashed = originalFollowersHashed.length - filteredFollowersHashed.length;

    // followingRaw: remove any ObjectId not in validUserIds
    const originalFollowingRaw = user.followingRaw || [];
    const filteredFollowingRaw = originalFollowingRaw.filter(id => validUserIds.has(id.toString()));
    const removedFollowingRaw = originalFollowingRaw.length - filteredFollowingRaw.length;

    // followingHashed: remove any hash not in validHashes
    const originalFollowingHashed = user.followingHashed || [];
    const filteredFollowingHashed = originalFollowingHashed.filter(hash => validHashes.has(hash));
    const removedFollowingHashed = originalFollowingHashed.length - filteredFollowingHashed.length;

    // If any were removed, update the user
    if (
      removedFollowersRaw > 0 ||
      removedFollowersHashed > 0 ||
      removedFollowingRaw > 0 ||
      removedFollowingHashed > 0
    ) {
      user.followersRaw = filteredFollowersRaw;
      user.followersHashed = filteredFollowersHashed;
      user.followingRaw = filteredFollowingRaw;
      user.followingHashed = filteredFollowingHashed;
      // Decrement followers and following counts by number removed
      user.followers = Math.max(0, (user.followers || 0) - removedFollowersRaw);
      user.following = Math.max(0, (user.following || 0) - removedFollowingRaw);
      await user.save();
      totalFixed++;
      console.log(
        `Fixed user ${user.username} (${user._id}): removed ${removedFollowersRaw} orphan followers, ${removedFollowingRaw} orphan followings. New followers: ${user.followers}, following: ${user.following}`
      );
    }
  }

  console.log(`Done. Fixed ${totalFixed} users with orphaned followers/followings.`);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => fixOrphanFollowersAndFollowings())
  .then(() => mongoose.disconnect())
  .catch(err => {
    console.error(err);
    mongoose.disconnect();
  });