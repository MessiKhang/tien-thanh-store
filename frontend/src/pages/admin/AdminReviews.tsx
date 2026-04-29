import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAllReviews,
  replyToReview,
  adminDeleteReview,
  adminUpdateReview,
  toggleReviewVisibility,
  type Review,
} from "../../services/reviewService";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./css/admin-reviews.css";
const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [editText, setEditText] = useState("");
const [isEditing, setIsEditing] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params: { isVisible?: boolean } = {};
      if (filter === "visible") params.isVisible = true;
      else if (filter === "hidden") params.isVisible = false;

      const res = await getAllReviews(params);
      setReviews(res.data);
    } catch (error: unknown) {
      console.error("fetchReviews error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể tải danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      toast.error("Vui lòng nhập nội dung trả lời");
      return;
    }

    try {
      setReplying(true);
      await replyToReview(reviewId, replyText);
      toast.success("Trả lời bình luận thành công!");
      setReplyText("");
      setSelectedReview(null);
      fetchReviews();
    } catch (error: unknown) {
      console.error("handleReply error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể trả lời bình luận");
    } finally {
      setReplying(false);
    }
  };

      const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
        try {
          await adminDeleteReview(id);
          toast.success("Xóa bình luận thành công!");
          fetchReviews();
        } catch (error: unknown) {
          console.error("handleDelete error:", error);
          const err = error as { response?: { data?: { message?: string } } };
          toast.error(err.response?.data?.message || "Không thể xóa bình luận");
        }
      };
    const handleEditComment = async (reviewId: string) => {
      if (!editText.trim()) {
        toast.error("Vui lòng nhập nội dung bình luận");
        return;
      }

      try {
        setReplying(true);

        await adminUpdateReview(reviewId, editText.trim());

        toast.success("Cập nhật bình luận thành công!");

        setEditText("");
        setSelectedReview(null);
        setIsEditing(false);

        fetchReviews();
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { message?: string } };
        };

        toast.error(
          err.response?.data?.message || "Không thể cập nhật bình luận"
        );
      } finally {
        setReplying(false);
      }
    };
  const handleToggleVisibility = async (id: string) => {
    try {
      await toggleReviewVisibility(id);
      toast.success("Thay đổi trạng thái thành công!");
      fetchReviews();
    } catch (error: unknown) {
      console.error("handleToggleVisibility error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể thay đổi trạng thái");
    }
  };

  const getProductName = (product: Review["productId"]) => {
    if (typeof product === "string") return "Sản phẩm";
    return product.name || "Sản phẩm";
  };

  const getProductImage = (product: Review["productId"]) => {
    if (typeof product === "string") return "";
    return product.image || "";
  };

  const getUserName = (user: Review["userId"]) => {
    if (typeof user === "string") return "Người dùng";
    return user.name || user.email || "Người dùng";
  };

  const getAdminName = (admin: Review["adminReply"] | undefined) => {
    if (!admin || !admin.repliedBy) return "";
    if (typeof admin.repliedBy === "string") return "Admin";
    return admin.repliedBy.name || "Admin";
  };

  if (loading) {
    return <div className="admin-reviews-container">Đang tải...</div>;
  }

  return (
    <div className="admin-reviews-container">
      <div className="admin-reviews-header">
        <h2>Quản lý bình luận </h2>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`filter-tab ${filter === "visible" ? "active" : ""}`}
            onClick={() => setFilter("visible")}
          >
            Đang hiển thị
          </button>
          <button
            className={`filter-tab ${filter === "hidden" ? "active" : ""}`}
            onClick={() => setFilter("hidden")}
          >
            Đã ẩn
          </button>
        </div>
      </div>

      <div className="admin-reviews-list">
        {reviews.length === 0 ? (
          <div className="empty-state">Chưa có đánh giá nào</div>
        ) : (
          reviews.map((review) => (
            <div
              key={review._id}
              className={`review-card ${!review.isVisible ? "hidden" : ""}`}
            >
              <div className="review-header">
                <div className="review-user-info">
                  <div className="review-product">
                    {getProductImage(review.productId) && (
                      <img
                        src={
                          getProductImage(review.productId).startsWith("http")
                            ? getProductImage(review.productId)
                            : `http://localhost:5000/${getProductImage(review.productId)}`
                        }
                        alt={getProductName(review.productId)}
                        className="product-thumb"
                      />
                    )}
                    <div>
                      <div className="product-name">
                        {getProductName(review.productId)}
                      </div>
                      <div className="user-name">
                        <i className="fa-solid fa-user"></i> {getUserName(review.userId)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="review-content">
                <p>{review.comment || "Không có bình luận"}</p>
                <div className="review-meta">
                  <span>
                    <i className="fa-solid fa-calendar"></i>{" "}
                    {new Date(review.createdAt).toLocaleString("vi-VN")}
                  </span>
                  <span className={`status-badge ${review.isVisible ? "visible" : "hidden"}`}>
                    {review.isVisible ? "Đang hiển thị" : "Đã ẩn"}
                  </span>
                </div>
              </div>

              {review.adminReply && review.adminReply.text && (
                <div className="admin-reply">
                  <div className="reply-header">
                    <i className="fa-solid fa-shield-halved"></i>
                    <strong>Phản hồi từ Admin ({getAdminName(review.adminReply)})</strong>
                    <span className="reply-date">
                      {new Date(review.adminReply.repliedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p>{review.adminReply.text}</p>
                </div>
              )}

                {selectedReview?._id === review._id && isEditing ? (
                  <div className="reply-form">
                    <textarea
                      placeholder="Chỉnh sửa phản hồi của Admin..."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />

                    <div className="reply-actions">
                      <button
                        className="btn-cancel"
                        onClick={() => {
                          setSelectedReview(null);
                          setEditText("");
                          setIsEditing(false);
                        }}
                      >
                        Hủy
                      </button>

                      <button
                        className="btn-submit"
                        onClick={() => handleEditComment(review._id)}
                        disabled={replying}
                      >
                        {replying ? "Đang lưu..." : "Lưu chỉnh sửa"}
                      </button>
                    </div>
                  </div>
                ) : selectedReview?._id === review._id && !isEditing ? (
                  <div className="reply-form">
                    <textarea
                      placeholder="Nhập phản hồi của bạn..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                    />

                    <div className="reply-actions">
                      <button
                        className="btn-cancel"
                        onClick={() => {
                          setSelectedReview(null);
                          setReplyText("");
                        }}
                      >
                        Hủy
                      </button>

                      <button
                        className="btn-submit"
                        onClick={() => handleReply(review._id)}
                        disabled={replying}
                      >
                        {replying ? "Đang gửi..." : "Gửi phản hồi"}
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="review-actions">
                {!review.adminReply?.text && (
                    <button
                      className="btn-reply"
                      onClick={() => {
                        setSelectedReview(review);
                        setIsEditing(false);
                        setReplyText("");
                      }}
                    >
                      <i className="fa-solid fa-reply"></i> Trả lời
                    </button>
                  )}
                  <button
                    className={`btn-toggle ${review.isVisible ? "hide" : "show"}`}
                    onClick={() => handleToggleVisibility(review._id)}
                  >
                    <i className={`fa-solid fa-eye${review.isVisible ? "-slash" : ""}`}></i>{" "}
                    {review.isVisible ? "Ẩn" : "Hiện"}
                  </button>
                    <button
                    className="btn-edit"
                    onClick={() => {
                      setSelectedReview(review);
                      setEditText(review.adminReply?.text || "");
                      setReplyText("");   // xoá nội dung reply cũ
                      setIsEditing(true);
                  }}
                    >
                    <i className="fa-solid fa-pen"></i> Sửa
                    </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminReviews;

