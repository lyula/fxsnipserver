const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  followersHashed: [{ type: String }],
  followingHashed: [{ type: String }],
  followingRaw: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  country: { type: String },
  countryCode: { type: String },
  countryFlag: { type: String },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);