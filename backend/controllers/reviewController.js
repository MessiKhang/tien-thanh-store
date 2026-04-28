const Review = require("../models/Review");
const Product = require("../models/Product");

// ===== GET REVIEWS BY PRODUCT =====
const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId, isVisible: true })
            .populate("userId", "name email")
            .populate("adminReply.repliedBy", "name")
            .sort({ createdAt: -1 });

        // Tính rating trung bình
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
            message: "Không thể lấy đánh giá",
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

        res.json({
            success: true,
            data: reviews,
        });
    } catch (error) {
        console.error("getReviewsByUser error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy đánh giá",
            error: error.message,
        });
    }
};

// ===== GET ALL REVIEWS (ADMIN) =====
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

        res.json({
            success: true,
            data: reviews,
        });
    } catch (error) {
        console.error("getAllReviews error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách đánh giá",
            error: error.message,
        });
    }
};

// ===== CREATE REVIEW (USER) =====
const createReview = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập để đánh giá",
            });
        }

        const { productId, rating, comment, images } = req.body;

        if (!productId || !rating) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin",
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Đánh giá phải từ 1 đến 5 sao",
            });
        }

        // Kiểm tra sản phẩm có tồn tại không
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Sản phẩm không tồn tại",
            });
        }

        // Kiểm tra đã đánh giá chưa
        const existingReview = await Review.findOne({ productId, userId });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "Bạn đã đánh giá sản phẩm này rồi",
            });
        }

        const review = await Review.create({
            productId,
            userId,
            rating: parseInt(rating),
            comment: comment || "",
            images: Array.isArray(images) ? images : [],
        });

        const populatedReview = await Review.findById(review._id)
            .populate("userId", "name email")
            .populate("productId", "name image");

        res.status(201).json({
            success: true,
            message: "Đánh giá thành công",
            data: populatedReview,
        });
    } catch (error) {
        console.error("createReview error:", error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Bạn đã đánh giá sản phẩm này rồi",
            });
        }
        res.status(500).json({
            success: false,
            message: "Không thể tạo đánh giá",
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
        const { rating, comment, images } = req.body;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đánh giá",
            });
        }

        // Chỉ user tạo đánh giá mới được sửa
        if (review.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền sửa đánh giá này",
            });
        }

        const updateData = {};
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Đánh giá phải từ 1 đến 5 sao",
                });
            }
            updateData.rating = parseInt(rating);
        }
        if (comment !== undefined) updateData.comment = comment;
        if (images !== undefined)
            updateData.images = Array.isArray(images) ? images : [];

        const updatedReview = await Review.findByIdAndUpdate(id, updateData, {
            new: true,
        })
            .populate("userId", "name email")
            .populate("productId", "name image")
            .populate("adminReply.repliedBy", "name");

        res.json({
            success: true,
            message: "Cập nhật đánh giá thành công",
            data: updatedReview,
        });
    } catch (error) {
        console.error("updateReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể cập nhật đánh giá",
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
                message: "Không tìm thấy đánh giá",
            });
        }

        // Chỉ user tạo đánh giá mới được xóa
        if (review.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xóa đánh giá này",
            });
        }

        await Review.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "Xóa đánh giá thành công",
        });
    } catch (error) {
        console.error("deleteReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xóa đánh giá",
            error: error.message,
        });
    }
};

// ===== ADMIN REPLY TO REVIEW =====
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
                message: "Vui lòng nhập nội dung trả lời",
            });
        }

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đánh giá",
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
            message: "Trả lời đánh giá thành công",
            data: populatedReview,
        });
    } catch (error) {
        console.error("replyToReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể trả lời đánh giá",
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
                message: "Không tìm thấy đánh giá",
            });
        }
        res.json({
            success: true,
            message: "Xóa đánh giá thành công",
        });
    } catch (error) {
        console.error("adminDeleteReview error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xóa đánh giá",
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
                message: "Không tìm thấy đánh giá",
            });
        }

        review.isVisible = !review.isVisible;
        await review.save();

        res.json({
            success: true,
            message: review.isVisible
                ? "Hiển thị đánh giá thành công"
                : "Ẩn đánh giá thành công",
            data: review,
        });
    } catch (error) {
        console.error("toggleReviewVisibility error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể thay đổi trạng thái đánh giá",
            error: error.message,
        });
    }
};
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

        // Cập nhật phản hồi của admin, KHÔNG đụng comment khách
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

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy bình luận",
            });
        }

        res.json({
            success: true,
            message: "Cập nhật bình luận thành công",
            data: review,
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
    updateReviewComment, // ← thêm dòng này
};
