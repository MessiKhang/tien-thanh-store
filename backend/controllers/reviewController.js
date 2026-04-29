const Review = require("../models/Review");
const Product = require("../models/Product");

// ===== GET REVIEWS BY PRODUCT =====
// Sorted: reviews with admin reply first (by repliedAt desc), then unreplied (by createdAt desc)
const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId, isVisible: true })
            .populate("userId", "name email")
            .populate("adminReply.repliedBy", "name")
            .sort({ productId: 1, createdAt: -1 });

        const avgRating =
            reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

        res.json({
            success: true,
            data: {
                reviews,
                averageRating: avgRating.toFixed(1),
                totalReviews: reviews.length,
            },
        });
    } catch (error) {
        console.error("getReviewsByProduct error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy bình luận",
            error: error.message,
        });
    }
};

// ===== GET REVIEWS BY USER =====
const getReviewsByUser = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập",
            });
        }

        const reviews = await Review.find({ userId })
            .populate("productId", "name image")
            .populate("adminReply.repliedBy", "name")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error("getReviewsByUser error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy bình luận",
            error: error.message,
        });
    }
};

// ===== GET ALL REVIEWS (ADMIN) =====
// Sorted: most recently replied first, then by createdAt desc
const getAllReviews = async (req, res) => {
    try {
        const { productId, userId, isVisible } = req.query;
        const filter = {};

        if (productId) filter.productId = productId;
        if (userId) filter.userId = userId;
        if (isVisible !== undefined) filter.isVisible = isVisible === "true";

        const reviews = await Review.find(filter)
            .populate("productId", "name image")
            .populate("userId", "name email")
            .populate("adminReply.repliedBy", "name")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error("getAllReviews error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách bình luận",
            error: error.message,
        });
    }
};

// ===== CREATE REVIEW (USER) =====
// Allows multiple reviews per user per product
const createReview = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập để bình luận",
            });
        }

        const { productId, comment, images } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin sản phẩm",
            });
        }

        if (!comment || !comment.trim()) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập nội dung bình luận",
            });
        }

        // Check product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Sản phẩm không tồn tại",
            });
        }

        // Allow multiple reviews — no duplicate check
        const review = await Review.create({
            productId,
            userId,
            comment: comment.trim(),
            images: Array.isArray(images) ? images : [],
        });

        const populatedReview = await Review.findById(review._id)
            .populate("userId", "name email")
            .populate("productId", "name image");

        res.status(201).json({
            success: true,
            message: "Bình luận thành công",
            data: populatedReview,
        });
    } catch (error) {
        console.error("createReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể tạo bình luận",
            error: error.message,
        });
    }
};

// ===== UPDATE REVIEW (USER) =====
const updateReview = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập",
            });
        }

        const { id } = req.params;
        const { comment } = req.body;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        if (review.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền sửa bình luận này",
            });
        }

        if (comment !== undefined) review.comment = comment;
        await review.save();

        const updatedReview = await Review.findById(id)
            .populate("userId", "name email")
            .populate("productId", "name image")
            .populate("adminReply.repliedBy", "name");

        res.json({
            success: true,
            message: "Cập nhật bình luận thành công",
            data: updatedReview,
        });
    } catch (error) {
        console.error("updateReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể cập nhật bình luận",
            error: error.message,
        });
    }
};

// ===== DELETE REVIEW (USER) =====
const deleteReview = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập",
            });
        }

        const { id } = req.params;
        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        if (review.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xóa bình luận này",
            });
        }

        await Review.findByIdAndDelete(id);
        res.json({ success: true, message: "Xóa bình luận thành công" });
    } catch (error) {
        console.error("deleteReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xóa bình luận",
            error: error.message,
        });
    }
};

// ===== ADMIN REPLY TO ANY REVIEW =====
// Can reply to any comment, overwrites previous reply
const replyToReview = async (req, res) => {
    try {
        const adminId = req.user?._id?.toString();
        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập",
            });
        }

        const { id } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập nội dung phản hồi",
            });
        }

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        review.adminReply = {
            text: text.trim(),
            repliedBy: adminId,
            repliedAt: new Date(),
        };

        await review.save();

        const populatedReview = await Review.findById(review._id)
            .populate("userId", "name email")
            .populate("productId", "name image")
            .populate("adminReply.repliedBy", "name");

        res.json({
            success: true,
            message: "Phản hồi thành công",
            data: populatedReview,
        });
    } catch (error) {
        console.error("replyToReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể phản hồi bình luận",
            error: error.message,
        });
    }
};

// ===== ADMIN DELETE REVIEW =====
const adminDeleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findByIdAndDelete(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }
        res.json({ success: true, message: "Xóa bình luận thành công" });
    } catch (error) {
        console.error("adminDeleteReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xóa bình luận",
            error: error.message,
        });
    }
};

// ===== ADMIN TOGGLE VISIBILITY =====
const toggleReviewVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        review.isVisible = !review.isVisible;
        await review.save();

        res.json({
            success: true,
            message: review.isVisible
                ? "Hiển thị bình luận thành công"
                : "Ẩn bình luận thành công",
            data: review,
        });
    } catch (error) {
        console.error("toggleReviewVisibility error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể thay đổi trạng thái",
            error: error.message,
        });
    }
};

// ===== ADMIN EDIT OWN REPLY =====
const updateReviewComment = async (req, res) => {
    try {
        const adminId = req.user?._id?.toString();
        const { comment } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nội dung phản hồi không được trống",
            });
        }

        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        // Only update adminReply — never touch customer comment
        review.adminReply = {
            text: comment.trim(),
            repliedBy: adminId,
            repliedAt: new Date(),
        };

        await review.save();

        const populated = await Review.findById(review._id)
            .populate("userId", "name email")
            .populate("productId", "name image")
            .populate("adminReply.repliedBy", "name");

        res.json({
            success: true,
            message: "Cập nhật phản hồi thành công",
            data: populated,
        });
    } catch (error) {
        console.error("updateReviewComment error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server",
            error,
        });
    }
};

module.exports = {
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
};
