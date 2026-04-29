const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        comment: {
            type: String,
            trim: true,
            default: "",
        },
        images: {
            type: [String],
            default: [],
        },
        adminReply: {
            text: {
                type: String,
                trim: true,
                default: "",
            },
            repliedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            repliedAt: {
                type: Date,
            },
        },
        isVisible: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    },
);

// Indexes for fast lookup — NO unique constraint on productId+userId
reviewSchema.index({ productId: 1, isVisible: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ createdAt: -1 });
// Sort: reviews with admin reply float to top, then by reply date desc
reviewSchema.index({ "adminReply.repliedAt": -1, createdAt: -1 });

module.exports =
    mongoose.models.Review || mongoose.model("Review", reviewSchema);
