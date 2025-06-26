require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function syncAllFollowCounts() {
  const users = await User.find({});
  for (const user of users) {
    user.followers = user.followersHashed ? user.followersHashed.length : 0;
    user.following = user.followingHashed ? user.followingHashed.length : 0;
    await user.save();
    console.log(`Synced ${user.username}: followers=${user.followers}, following=${user.following}`);
  }
  console.log("Done syncing all users.");
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(syncAllFollowCounts)
  .then(() => mongoose.disconnect());