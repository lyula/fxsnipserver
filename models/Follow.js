const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
});

module.exports = mongoose.model("Follow", followSchema);