const express = require("express");
const router = express.Router();
const { requireAuth: auth } = require("../middleware/auth");
const {
  createReportReason,
  updateReportReason,
  deleteReportReason,
  getReportReasons,
  getAllReportReasons
} = require("../controllers/reportReasonController");

// Public routes
router.get("/", auth, getReportReasons); // Get active report reasons for users

// Admin routes
router.post("/", auth, createReportReason); // Create new report reason
router.put("/:reasonId", auth, updateReportReason); // Update report reason
router.delete("/:reasonId", auth, deleteReportReason); // Delete report reason
router.get("/all", auth, getAllReportReasons); // Get all report reasons including inactive

module.exports = router;
