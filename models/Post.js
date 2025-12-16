const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema(
  {
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // User being replied to (for replies to replies)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    editedAt: { type: Date },
    isEdited: { type: Boolean, default: false },
  },
  { _id: true }
);

const CommentSchema = new mongoose.Schema(
  {
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [ReplySchema],
    editedAt: { type: Date },
    isEdited: { type: Boolean, default: false },
  },
  { _id: true }
);

const MediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  type: { type: String, enum: ['image', 'video'], required: true },
  width: { type: Number },
  height: { type: Number },
  format: { type: String },
  bytes: { type: Number }
}, { _id: false });

const PostSchema = new mongoose.Schema(
  {
    content: String,
    // Legacy fields for backward compatibility
    image: { type: String },
    imagePublicId: { type: String },
    video: { type: String },
    videoPublicId: { type: String },
    // New multiple media support
    media: [MediaSchema],
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comments: [CommentSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    views: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    shareCount: { type: Number, default: 0 }, // Track number of times post is shared
    editedAt: { type: Date },
    isEdited: { type: Boolean, default: false },
    // Post reporting and moderation fields
    reportCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false }, // Auto-hidden when reportCount >= 15
    hiddenAt: { type: Date },
    isDeleted: { type: Boolean, default: false }, // Soft delete by admin
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { 
    timestamps: true // This adds createdAt and updatedAt automatically
  }
);

// Added these middleware functions before module.exports

// Auto-update updatedAt for replies
ReplySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Auto-update updatedAt for comments
CommentSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Post", PostSchema);