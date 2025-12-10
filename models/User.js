const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String, enum: ["male", "female", "other"], required: true },
  dateOfBirth: { type: Date, required: true },
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
    bio: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    // Add more profile fields as needed
  },
  expoPushToken: { type: String, default: "" }, // Expo push notification token
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);