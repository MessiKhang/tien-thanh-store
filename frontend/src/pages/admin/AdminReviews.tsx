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

type GroupedProduct = {
  productId: string;
  productName: string;
  productImage: string;
  reviews: Review[];
};

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editText, setEditText] = useState("");
  const [submitting, setSubmitting] = useState(false);

const fetchReviews = useCallback(async () => {
  try {
    setLoading(true);
    const res = await getAllReviews({});
    setReviews(res.data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    toast.error(err.response?.data?.message || "Không thể tải danh sách bình luận");
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Group reviews by product
  const groupedProducts: GroupedProduct[] = React.useMemo(() => {
    const map = new Map<string, GroupedProduct>();
    reviews.forEach((review) => {
      const pid = typeof review.productId === "string"
        ? review.productId
        : review.productId._id;
      const pname = typeof review.productId === "string"
        ? "Sản phẩm"
        : review.productId.name || "Sản phẩm";
      const pimage = typeof review.productId === "string"
        ? ""
        : review.productId.image || "";

      if (!map.has(pid)) {
        map.set(pid, { productId: pid, productName: pname, productImage: pimage, reviews: [] });
      }
      map.get(pid)!.reviews.push(review);
    });
    return Array.from(map.values());
  }, [reviews]);

  const getUserName = (user: Review["userId"]) => {
    if (typeof user === "string") return "Người dùng";
    return user.name || user.email || "Người dùng";
  };

  const getUserInitial = (user: Review["userId"]) => {
    const name = getUserName(user);
    return name.charAt(0).toUpperCase();
  };

  const getAdminName = (admin: Review["adminReply"] | undefined) => {
    if (!admin || !admin.repliedBy) return "Admin";
    if (typeof admin.repliedBy === "string") return "Admin";
    return admin.repliedBy.name || "Admin";
  };

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      toast.error("Vui lòng nhập nội dung trả lời");
      return;
    }
    try {
      setSubmitting(true);
      await replyToReview(reviewId, replyText);
      toast.success("Phản hồi thành công!");
      setReplyText("");
      setReplyingId(null);
      fetchReviews();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể phản hồi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReply = async (reviewId: string) => {
    if (!editText.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi");
      return;
    }
    try {
      setSubmitting(true);
      await adminUpdateReview(reviewId, editText.trim());
      toast.success("Cập nhật phản hồi thành công!");
      setEditText("");
      setEditingId(null);
      fetchReviews();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể cập nhật phản hồi");
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return <div className="admin-reviews-container">Đang tải...</div>;
  }

  return (
    <div className="admin-reviews-container">
      <div className="admin-reviews-header">
        <h2>Quản lý bình luận</h2>
      </div>

      <div className="admin-reviews-list">
        {groupedProducts.length === 0 ? (
          <div className="empty-state">Chưa có bình luận nào</div>
        ) : (
          groupedProducts.map((group) => (
            <div key={group.productId} className="product-group">
              {/* Product Header */}
              <div className="product-group-header">
                {group.productImage && (
                  <img
                    src={
                      group.productImage.startsWith("http")
                        ? group.productImage
                        : `http://localhost:5000/${group.productImage}`
                    }
                    alt={group.productName}
                    className="product-thumb"
                  />
                )}
                <div className="product-group-info">
                  <span className="product-group-name">{group.productName}</span>
                  <span className="product-group-count">
                    {group.reviews.length} bình luận
                  </span>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="chat-thread">
                {group.reviews.map((review) => (
                  <div
                    key={review._id}
                    className="chat-item"
                  >
                    {/* Customer Message */}
                    <div className="chat-message chat-message--customer">
                      <div className="chat-avatar chat-avatar--customer">
                        {getUserInitial(review.userId)}
                      </div>
                      <div className="chat-bubble-wrapper">
                        <div className="chat-meta">
                          <span className="chat-name">{getUserName(review.userId)}</span>
                          <span className="chat-time">
                            {new Date(review.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <div className="chat-bubble chat-bubble--customer">
                          {review.comment || "Không có nội dung"}
                        </div>
                        {/* Action buttons */}
                        <div className="chat-actions">
                            <button className="chat-action-btn chat-action-btn--reply" onClick={() => { setReplyingId(review._id); setEditingId(null); setReplyText(""); }}>
                              <i className="fa-solid fa-reply"></i> Trả lời
                            </button>
                          </div>
                      </div>
                    </div>

                    {/* Admin Reply */}
                    {review.adminReply?.text && (
                      <div className="chat-message chat-message--admin">
                        <div className="chat-bubble-wrapper chat-bubble-wrapper--admin">
                          <div className="chat-meta chat-meta--admin">
                            <span className="chat-name chat-name--admin">
                              <i className="fa-solid fa-shield-halved"></i>{" "}
                              {getAdminName(review.adminReply)}
                            </span>
                            <span className="chat-time">
                              {new Date(review.adminReply.repliedAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                          <div className="chat-bubble chat-bubble--admin">
                            {review.adminReply.text}
                          </div>
                          <div className="chat-actions chat-actions--admin">
                            <button
                              className="chat-action-btn chat-action-btn--edit"
                              onClick={() => {
                                setEditingId(review._id);
                                setReplyingId(null);
                                setEditText(review.adminReply?.text || "");
                              }}
                            >
                              <i className="fa-solid fa-pen"></i> Sửa phản hồi
                            </button>
                          </div>
                        </div>
                        <div className="chat-avatar chat-avatar--admin">A</div>
                      </div>
                    )}

                    {/* Reply Input */}
                    {replyingId === review._id && (
                      <div className="chat-input-row">
                        <div className="chat-avatar chat-avatar--admin">A</div>
                        <div className="chat-input-wrapper">
                          <textarea
                            className="chat-input"
                            placeholder="Nhập phản hồi..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className="chat-input-actions">
                            <button
                              className="chat-input-btn chat-input-btn--cancel"
                              onClick={() => { setReplyingId(null); setReplyText(""); }}
                            >
                              Hủy
                            </button>
                            <button
                              className="chat-input-btn chat-input-btn--send"
                              onClick={() => handleReply(review._id)}
                              disabled={submitting || !replyText.trim()}
                            >
                              {submitting ? "Đang gửi..." : "Gửi"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Edit Reply Input */}
                    {editingId === review._id && (
                      <div className="chat-input-row">
                        <div className="chat-avatar chat-avatar--admin">A</div>
                        <div className="chat-input-wrapper">
                          <textarea
                            className="chat-input"
                            placeholder="Chỉnh sửa phản hồi..."
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className="chat-input-actions">
                            <button
                              className="chat-input-btn chat-input-btn--cancel"
                              onClick={() => { setEditingId(null); setEditText(""); }}
                            >
                              Hủy
                            </button>
                            <button
                              className="chat-input-btn chat-input-btn--send"
                              onClick={() => handleEditReply(review._id)}
                              disabled={submitting || !editText.trim()}
                            >
                              {submitting ? "Đang lưu..." : "Lưu"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminReviews;