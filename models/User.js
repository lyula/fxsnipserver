const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String, enum: ["male", "female", "other"] },
  dateOfBirth: { type: Date },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  followersHashed: {
    type: [String],
    default: [],
  },
  followingHashed: [{ type: String }],
  followingRaw: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  country: { type: String },
  countryCode: { type: String },
  countryFlag: { type: String },
  verified: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  profile: {
    profileImage: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "" }, // Store Cloudinary public ID
    coverImage: { type: String, default: "" },
    coverImagePublicId: { type: String, default: "" }, // Store Cloudinary public ID for cover image
    bio: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    // Add more profile fields as needed
  },
  expoPushToken: { type: String, default: "" }, // Expo push notification token
  // User role and moderation
  role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  // Activity restrictions (Instagram-like behavior for suspicious activity)
  restrictions: {
    canCreatePosts: { type: Boolean, default: true },
    canLikePosts: { type: Boolean, default: true },
    canComment: { type: Boolean, default: true },
    canFollow: { type: Boolean, default: true },
    canMessage: { type: Boolean, default: true },
    canShare: { type: Boolean, default: true },
    restrictedUntil: { type: Date }, // Temporary restriction expiry
    restrictionReason: { type: String },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    restrictedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);