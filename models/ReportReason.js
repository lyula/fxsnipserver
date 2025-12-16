const mongoose = require("mongoose");

const ReportReasonSchema = new mongoose.Schema(
  {
    reason: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true 
    },
    description: { 
      type: String, 
      default: "" 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    order: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportReason", ReportReasonSchema);
