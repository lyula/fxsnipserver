const mongoose = require("mongoose");

const PostReportSchema = new mongoose.Schema(
  {
    post: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Post", 
      required: true 
    },
    reportedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    reason: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ReportReason", 
      required: true 
    },
    additionalInfo: { 
      type: String, 
      default: "" 
    },
    status: { 
      type: String, 
      enum: ['pending', 'reviewed', 'dismissed', 'action_taken'],
      default: 'pending' 
    },
    reviewedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    reviewedAt: { 
      type: Date 
    },
    reviewNote: { 
      type: String 
    }
  },
  { timestamps: true }
);

// Prevent duplicate reports from same user for same post
PostReportSchema.index({ post: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model("PostReport", PostReportSchema);
