const express = require("express");
const router = express.Router();
const { requireAuth: auth } = require("../middleware/auth");
const {
  reportPost,
  getReportedPosts,
  getPostReports,
  dismissReports,
  deleteReportedPost,
  getReportStats
} = require("../controllers/postReportController");

// User routes
router.post("/:postId", auth, reportPost); // Report a post

// Admin routes
router.get("/", auth, getReportedPosts); // Get all reported posts (grouped)
router.get("/stats", auth, getReportStats); // Get report statistics
router.get("/:postId", auth, getPostReports); // Get all reports for a specific post
router.post("/:postId/dismiss", auth, dismissReports); // Dismiss reports and restore post
router.delete("/:postId", auth, deleteReportedPost); // Delete reported post permanently

module.exports = router;
