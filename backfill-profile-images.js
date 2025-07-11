// backfill-profile-images.js
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
require('dotenv').config(); 

const MONGO_URI =(process.env.MONGO_URI); // Update with your DB

async function backfillProfileImages() {
  await mongoose.connect(MONGO_URI);

  // Find all users with a profileImage
  const usersWithProfileImage = await User.find({ profileImage: { $exists: true, $ne: null } });

  for (const user of usersWithProfileImage) {
    // Update all posts by this user to set author.profileImage
    await Post.updateMany(
      { 'author._id': user._id },
      { $set: { 'author.profileImage': user.profileImage } }
    );
    console.log(`Updated posts for user ${user.username}`);
  }

  await mongoose.disconnect();
  console.log('Backfill complete.');
}

backfillProfileImages().catch(console.error);