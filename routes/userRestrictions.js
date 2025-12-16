const express = require("express");
const router = express.Router();
const { requireAuth: auth } = require("../middleware/auth");
const {
  restrictUser,
  unrestrictUser,
  getUserRestrictions,
  getRestrictedUsers,
  checkMyRestrictions
} = require("../controllers/userRestrictionController");

// User routes
router.get("/me", auth, checkMyRestrictions); // Check own restriction status

// Admin routes
router.post("/:userId/restrict", auth, restrictUser); // Restrict user activities
router.post("/:userId/unrestrict", auth, unrestrictUser); // Remove restrictions
router.get("/:userId", auth, getUserRestrictions); // Get user restriction status
router.get("/", auth, getRestrictedUsers); // Get all restricted users

module.exports = router;
