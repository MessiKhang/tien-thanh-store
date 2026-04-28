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
    updateReviewComment, // ← add this
} = require("../controllers/reviewController");

const {
    authenticateToken,
    requireAdmin,
} = require("../controllers/authController");

const router = express.Router();

// Public routes
router.get("/product/:productId", getReviewsByProduct);

// User routes
router.get("/user/my-reviews", authenticateToken, getReviewsByUser);
router.post("/", authenticateToken, createReview);
router.put("/:id", authenticateToken, updateReview);
router.delete("/:id", authenticateToken, deleteReview);

// Admin routes
router.get("/", authenticateToken, requireAdmin, getAllReviews);
router.post("/:id/reply", authenticateToken, requireAdmin, replyToReview);
router.delete("/:id/admin", authenticateToken, requireAdmin, adminDeleteReview);
router.patch(
    "/:id/visibility",
    authenticateToken,
    requireAdmin,
    toggleReviewVisibility,
);
router.put(
    "/:id/comment",
    authenticateToken,
    requireAdmin,
    updateReviewComment,
); // ← add this

module.exports = router;
