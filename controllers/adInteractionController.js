const AdInteraction = require('../models/AdInteraction');
const Ad = require('../models/Ad');

// Like or unlike an ad
exports.likeAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user._id;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    const liked = interaction.likes.includes(userId);
    if (liked) {
      interaction.likes.pull(userId);
    } else {
      interaction.likes.push(userId);
    }
    await interaction.save();
    res.json({ liked: !liked, likesCount: interaction.likes.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to like/unlike ad.' });
  }
};

// Add a comment to an ad
exports.commentAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user._id;
  const { text } = req.body;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    interaction.comments.push({ user: userId, text });
    await interaction.save();
    res.json({ comments: interaction.comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to comment on ad.' });
  }
};

// Reply to a comment
exports.replyComment = async (req, res) => {
  const { adId, commentId } = req.params;
  const userId = req.user._id;
  const { text } = req.body;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) return res.status(404).json({ error: 'Ad interaction not found.' });
    const comment = interaction.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    comment.replies.push({ user: userId, text });
    await interaction.save();
    res.json({ replies: comment.replies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reply to comment.' });
  }
};

// Share an ad
exports.shareAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user._id;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    if (!interaction.shares.includes(userId)) {
      interaction.shares.push(userId);
      await interaction.save();
    }
    res.json({ sharesCount: interaction.shares.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to share ad.' });
  }
};

// Track a view
exports.viewAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user._id;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    if (!interaction.views.includes(userId)) {
      interaction.views.push(userId);
      interaction.viewCount += 1;
      await interaction.save();
    }
    res.json({ viewCount: interaction.viewCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track view.' });
  }
};

// Get all interactions for an ad
exports.getAdInteractions = async (req, res) => {
  const { adId } = req.params;
  try {
    const interaction = await AdInteraction.findOne({ ad: adId })
      .populate('likes', 'username profile')
      .populate('comments.user', 'username profile')
      .populate('comments.replies.user', 'username profile')
      .populate('shares', 'username profile');
    res.json(interaction || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ad interactions.' });
  }
};
