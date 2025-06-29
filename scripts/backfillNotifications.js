// scripts/backfillNotifications.js
const mongoose = require("mongoose");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const User = require("../models/User");

async function main() {
  await mongoose.connect("mongodb+srv://sacredlyula:4bkvZSUfRfWqBCW9@fxsnipdb.lotjlph.mongodb.net/fxsnipdb?retryWrites=true&w=majority&appName=fxsnipdb"); // update with your connection string

  // Build a lookup map of userId -> user object (for username, etc.)
  const users = await User.find().lean();
  const userMap = {};
  for (const user of users) {
    userMap[String(user._id)] = user;
  }

  const posts = await Post.find().lean();

  for (const post of posts) {
    // Post likes
    for (const likerId of post.likes) {
      if (String(likerId) !== String(post.author)) {
        const liker = userMap[String(likerId)];
        const postOwner = userMap[String(post.author)];
        if (liker && postOwner) {
          await Notification.create({
            user: post.author,
            from: likerId,
            type: "like_post",
            post: post._id,
            message: `${liker.username} liked your post.`,
          });
        }
      }
    }
    // Comments
    for (const comment of post.comments) {
      // Comment likes
      for (const likerId of comment.likes) {
        if (String(likerId) !== String(comment.author)) {
          const liker = userMap[String(likerId)];
          const commentOwner = userMap[String(comment.author)];
          if (liker && commentOwner) {
            await Notification.create({
              user: comment.author,
              from: likerId,
              type: "like_comment",
              post: post._id,
              comment: comment._id,
              message: `${liker.username} liked your comment on a post.`,
            });
          }
        }
      }
      // Comment itself
      if (String(comment.author) !== String(post.author)) {
        const commenter = userMap[String(comment.author)];
        const postOwner = userMap[String(post.author)];
        if (commenter && postOwner) {
          await Notification.create({
            user: post.author,
            from: comment.author,
            type: "comment",
            post: post._id,
            message: `${commenter.username} commented on your post.`,
          });
        }
      }
      // Replies
      for (const reply of comment.replies) {
        // Reply likes
        for (const likerId of reply.likes) {
          if (String(likerId) !== String(reply.author)) {
            const liker = userMap[String(likerId)];
            const replyOwner = userMap[String(reply.author)];
            if (liker && replyOwner) {
              await Notification.create({
                user: reply.author,
                from: likerId,
                type: "like_reply",
                post: post._id,
                comment: comment._id,
                reply: reply._id,
                message: `${liker.username} liked your reply on a post.`,
              });
            }
          }
        }
        // Reply itself
        if (String(reply.author) !== String(comment.author)) {
          const replier = userMap[String(reply.author)];
          const commentOwner = userMap[String(comment.author)];
          if (replier && commentOwner) {
            await Notification.create({
              user: comment.author,
              from: reply.author,
              type: "reply",
              post: post._id,
              comment: comment._id,
              message: `${replier.username} replied to your comment on a post.`,
            });
          }
        }
      }
    }
  }

  console.log("Backfill complete!");
  process.exit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});