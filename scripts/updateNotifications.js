const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Post = require("../models/Post");

// Update this with your actual MongoDB connection string
const MONGODB_URI = "mongodb://localhost:27017/your-db-name";

async function updateNotifications() {
  await mongoose.connect(MONGODB_URI);

  const notifications = await Notification.find();

  for (const notification of notifications) {
    // Example: update message format if needed
    if (notification.type === "like_post" && notification.from && notification.post) {
      const user = await User.findById(notification.from);
      const post = await Post.findById(notification.post);
      if (user && post) {
        notification.message = `${user.username} liked your post.`;
        await notification.save();
      }
    }
    // Add more update logic for other notification types as needed
  }

  console.log("Notifications updated!");
  mongoose.disconnect();
}

updateNotifications().catch(console.error);