const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReplySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const CommentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  replies: [ReplySchema],
  createdAt: { type: Date, default: Date.now }
});

const AdInteractionSchema = new Schema({
  ad: { type: Schema.Types.ObjectId, ref: 'Ad', required: true },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [CommentSchema],
  shares: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  views: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  viewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdInteraction', AdInteractionSchema);
