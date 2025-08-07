const AdInteraction = require('../models/AdInteraction');
const Ad = require('../models/Ad');

// Like or unlike an ad
exports.likeAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user.id; // Use decoded JWT id
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }

    const alreadyLiked = interaction.likes.some((id) => String(id) === String(userId));
    if (alreadyLiked) {
      interaction.likes = interaction.likes.filter((id) => String(id) !== String(userId));
    } else {
      interaction.likes.push(userId);
    }

    await interaction.save();

    // Re-fetch and fully populate the AdInteraction object
    const populatedInteraction = await AdInteraction.findOne({ ad: adId })
      .populate('likes', 'username profile')
      .populate('comments.user', 'username profile')
      .populate('comments.replies.user', 'username profile')
      .populate('shares', 'username profile');

    res.status(200).json(populatedInteraction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to like/unlike ad.' });
  }
};

// Add a comment to an ad
exports.commentAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user.id; // Use decoded JWT id
  const { text } = req.body;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    interaction.comments.push({ user: userId, text });
    await interaction.save();
    const populated = await AdInteraction.findOne({ ad: adId })
      .populate('comments.user', 'username profile')
      .populate('comments.replies.user', 'username profile');
    res.json({ comments: populated?.comments || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to comment on ad.' });
  }
};

// Reply to a comment
exports.replyComment = async (req, res) => {
  const { adId, commentId } = req.params;
  const userId = req.user.id; // Use decoded JWT id
  const { text } = req.body;
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) return res.status(404).json({ error: 'Ad interaction not found.' });
    const comment = interaction.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    comment.replies.push({ user: userId, text });
    await interaction.save();
    const populated = await AdInteraction.findOne({ ad: adId })
      .populate('comments.user', 'username profile')
      .populate('comments.replies.user', 'username profile');
    const populatedComment = populated?.comments.id(commentId);
    res.json({ replies: populatedComment?.replies || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reply to comment.' });
  }
};

// Share an ad
exports.shareAd = async (req, res) => {
  const { adId } = req.params;
  const userId = req.user.id; // Use decoded JWT id
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    const hasShared = interaction.shares.some((id) => String(id) === String(userId));
    if (!hasShared) {
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
  const userId = req.user.id; // Use decoded JWT id
  try {
    let interaction = await AdInteraction.findOne({ ad: adId });
    if (!interaction) {
      interaction = new AdInteraction({ ad: adId });
    }
    const hasViewed = interaction.views.some((id) => String(id) === String(userId));
    if (!hasViewed) {
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
