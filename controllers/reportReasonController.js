const ReportReason = require("../models/ReportReason");

// Admin: Create a new report reason
exports.createReportReason = async (req, res) => {
  try {
    const { reason, description, order } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const reportReason = new ReportReason({
      reason,
      description,
      order: order || 0,
      createdBy: req.user.id
    });

    await reportReason.save();
    res.status(201).json({ message: "Report reason created successfully", reportReason });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Report reason already exists" });
    }
    console.error("Error creating report reason:", error);
    res.status(500).json({ error: "Failed to create report reason" });
  }
};

// Admin: Update a report reason
exports.updateReportReason = async (req, res) => {
  try {
    const { reasonId } = req.params;
    const { reason, description, order, isActive } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const reportReason = await ReportReason.findByIdAndUpdate(
      reasonId,
      { reason, description, order, isActive },
      { new: true, runValidators: true }
    );

    if (!reportReason) {
      return res.status(404).json({ error: "Report reason not found" });
    }

    res.json({ message: "Report reason updated successfully", reportReason });
  } catch (error) {
    console.error("Error updating report reason:", error);
    res.status(500).json({ error: "Failed to update report reason" });
  }
};

// Admin: Delete a report reason
exports.deleteReportReason = async (req, res) => {
  try {
    const { reasonId } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const reportReason = await ReportReason.findByIdAndDelete(reasonId);

    if (!reportReason) {
      return res.status(404).json({ error: "Report reason not found" });
    }

    res.json({ message: "Report reason deleted successfully" });
  } catch (error) {
    console.error("Error deleting report reason:", error);
    res.status(500).json({ error: "Failed to delete report reason" });
  }
};

// Get all report reasons (public for users to see options)
exports.getReportReasons = async (req, res) => {
  try {
    const reportReasons = await ReportReason.find({ isActive: true })
      .sort({ order: 1, reason: 1 })
      .select("-createdBy");

    res.json({ reportReasons });
  } catch (error) {
    console.error("Error fetching report reasons:", error);
    res.status(500).json({ error: "Failed to fetch report reasons" });
  }
};

// Admin: Get all report reasons including inactive
exports.getAllReportReasons = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    const reportReasons = await ReportReason.find()
      .sort({ order: 1, reason: 1 })
      .populate("createdBy", "username");

    res.json({ reportReasons });
  } catch (error) {
    console.error("Error fetching all report reasons:", error);
    res.status(500).json({ error: "Failed to fetch report reasons" });
  }
};
