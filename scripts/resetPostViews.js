require("dotenv").config();
const mongoose = require("mongoose");
const Post = require("../models/Post");

async function resetAllPostViews() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await Post.updateMany({}, { $set: { views: 0 } });
    console.log(`Reset views for ${result.modifiedCount || result.nModified} posts.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error resetting post views:", err);
    process.exit(1);
  }
}

resetAllPostViews();