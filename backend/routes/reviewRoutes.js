const express = require("express");
const {
    getReviewsByProduct,
    getReviewsByUser,
    getAllReviews,
    createReview,
    updateReview,
    deleteReview,
    replyToReview,
    adminDeleteReview,
    toggleReviewVisibility,
    updateReviewComment,
} = require("../controllers/reviewController");

const {
    authenticateToken,
    requireAdmin,
} = require("../controllers/authController");

const router = express.Router();

// ===== PUBLIC =====
router.get("/product/:productId", getReviewsByProduct);

// ===== USER =====
router.get("/user/my-reviews", authenticateToken, getReviewsByUser);
router.post("/", authenticateToken, createReview);
router.put("/:id", authenticateToken, updateReview);
router.delete("/:id", authenticateToken, deleteReview);

// ===== ADMIN =====
router.get("/", authenticateToken, requireAdmin, getAllReviews);
router.post("/:id/reply", authenticateToken, requireAdmin, replyToReview);
router.put("/:id/comment", authenticateToken, requireAdmin, updateReviewComment);
router.delete("/:id/admin", authenticateToken, requireAdmin, adminDeleteReview);
router.patch("/:id/visibility", authenticateToken, requireAdmin, toggleReviewVisibility);

module.exports = router;