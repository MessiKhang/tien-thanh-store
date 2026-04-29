import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/orders-detail.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../../context/AuthContext";
import {
  getOrderDetail,
  cancelOrder,
  type Order,
  type OrderStatus,
} from "../../services/orderService";
import { toast } from "sonner";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  handover_to_carrier: "Đã bàn giao vận chuyển",
  shipping: "Đang giao hàng",
  delivered: "Đã giao hàng",
  received: "Khách đã nhận",
  cancelled: "Đã huỷ",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "order-status-pending",
  processing: "order-status-preparing",
  handover_to_carrier: "order-status-preparing",
  shipping: "order-status-shipping",
  delivered: "order-status-done",
  received: "order-status-done",
  cancelled: "order-status-cancel",
};

const OrderCheck: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, isAuth, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!orderId) return;
    try {
      setFetching(true);
      const res = await getOrderDetail(orderId);
      setOrder(res.data);
    } catch (error) {
      console.error("getOrderDetail error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không tìm thấy đơn hàng.");
      navigate("/orders", { replace: true });
    } finally {
      setFetching(false);
    }
  }, [orderId, navigate]);

  useEffect(() => {
    if (loading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập.");
      navigate("/login", {
        replace: true,
        state: { redirect: `/orders/${orderId}` },
      });
      return;
    }
    loadDetail();
  }, [loading, isAuth, user, orderId, navigate, loadDetail]);

  

  const handleCancel = async () => {
    if (!orderId) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) {
      return;
    }
    try {
      setCancelling(true);
      await cancelOrder(orderId);
      toast.success("Đã hủy đơn hàng thành công!");
      loadDetail();
    } catch (error) {
      console.error("cancelOrder error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể hủy đơn hàng.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading || fetching || !order) {
    return <div className="order-detail-main">Đang tải đơn hàng...</div>;
  }

  const shipping = order.shippingInfo;
  const addressParts = [
    shipping.address,
    shipping.ward,
    shipping.district,
    shipping.city,
  ]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(", ");

  return (
    <div className="order-detail-main">
      <div className="breadcrumb">
        <Link to="/home">Trang chủ</Link> <span>&gt;</span>{" "}
        <Link to="/orders">Đơn hàng của tôi</Link> <span>&gt;</span>{" "}
        <span className="breadcrumb-current">Chi tiết đơn #{order.code}</span>
      </div>

      <div className="order-detail-header">
        <h1>
          Chi tiết đơn hàng <span>#{order.code}</span>
        </h1>
        <div className={`order-detail-status ${STATUS_CLASS[order.status] || ""}`}>
          <i className="fa fa-info-circle"></i> {STATUS_LABELS[order.status]}
        </div>
        <div className="order-detail-meta">
          <div>
            <i className="fa fa-calendar-alt"></i> Đặt ngày:{" "}
            <b>{new Date(order.createdAt).toLocaleString("vi-VN")}</b>
          </div>
          <div>
            <i className="fa fa-map-marker-alt"></i> Giao đến:{" "}
            <b>
              {[shipping.fullName, addressParts]
                .filter((value) => value && value.trim().length > 0)
                .join(", ")}
              {shipping.phone ? ` (${shipping.phone})` : ""}
            </b>
          </div>
          <div>
            <i className="fa fa-money-bill"></i> Thanh toán:{" "}
            <b>
              {order.paymentMethod === "cod"
                ? "Thanh toán khi nhận hàng"
                : order.paymentMethod.toUpperCase()}
            </b>
          </div>
        </div>
      </div>

      <div className="order-detail-products">
        <h2>Sản phẩm</h2>
        <div className="order-detail-product-list">
          {order.items.map((item) => {
            const itemPrice = item.price;
            const itemOldPrice = item.oldPrice || item.price;
            const hasSale = itemOldPrice > itemPrice && itemOldPrice > 0;
            const itemTotal = itemPrice * item.quantity;
            const itemOldTotal = hasSale ? itemOldPrice * item.quantity : itemTotal;
            return (
              <div className="order-detail-product-item" key={item.productId}>
                <img src={item.image} alt={item.name} />
                <div className="order-detail-product-info">
                  <div className="order-detail-product-name">{item.name}</div>
                  {item.selectedColor && (
                    <div className="order-detail-product-opt" style={{ color: "#666", fontSize: "13px", marginBottom: "4px" }}>
                      Màu: {item.selectedColor}
                    </div>
                  )}
                  <div className="order-detail-product-qty">
                    Số lượng: <b>{item.quantity}</b>
                  </div>
                </div>
                <div className="order-detail-product-price">
                  {hasSale ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                      <span style={{ color: "#d90019", fontWeight: 600 }}>
                        {itemTotal.toLocaleString()}₫
                      </span>
                      <span style={{ color: "#999", textDecoration: "line-through", fontSize: "13px" }}>
                        {itemOldTotal.toLocaleString()}₫
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "#d90019", fontWeight: 600 }}>
                      {itemTotal.toLocaleString()}₫
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="order-detail-summary">
        <h2>Thanh toán</h2>
        {/* Tính toán lại từ items nếu totals không có (đơn hàng cũ) */}
        {(() => {
          const calculatedOriginalTotal = order.items.reduce(
            (sum, item) => sum + (item.oldPrice || item.price) * item.quantity,
            0
          );
          const calculatedTotal = order.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          const calculatedSavings = calculatedOriginalTotal - calculatedTotal;
          
          // Sử dụng giá trị từ totals nếu có, nếu không thì tính lại
          const subTotal = order.totals.subTotal !== undefined ? order.totals.subTotal : calculatedTotal;
          const total = order.totals.total !== undefined ? order.totals.total : calculatedTotal;
          const savings = order.totals.savings !== undefined ? order.totals.savings : calculatedSavings;
          
          return (
            <>
              <div className="order-detail-sumrow">
                <span>Tạm tính</span>
                <span>{subTotal.toLocaleString()}đ</span>
              </div>
              {savings > 0 && (
                <div className="order-detail-sumrow" style={{ color: "#28a745" }}>
                  <span>Tiết kiệm</span>
                  <span style={{ color: "#28a745", fontWeight: 600 }}>
                    -{savings.toLocaleString()}đ
                  </span>
                </div>
              )}
              <div className="order-detail-sumrow" style={{ fontWeight: 600, paddingTop: "8px", borderTop: "1px solid #e0e0e0" }}>
                <span>Thành tiền</span>
                <span style={{ color: "#d90019", fontWeight: 600 }}>{total.toLocaleString()}đ</span>
              </div>
              {order.totals.discount > 0 && (
                <div className="order-detail-sumrow">
                  <span>Giảm giá</span>
                  <span>-{order.totals.discount.toLocaleString()}đ</span>
                </div>
              )}
              <div className="order-detail-sumrow">
                <span>Phí vận chuyển</span>
                <span>{order.totals.shippingFee.toLocaleString()}đ</span>
              </div>
              <div className="order-detail-sumrow order-detail-sumtotal">
                <span>Tổng cộng</span>
                <span>{order.totals.grandTotal.toLocaleString()}đ</span>
              </div>
            </>
          );
        })()}
      </div>

      <div className="order-detail-note">
        <strong>Ghi chú:</strong> {shipping.note || "Không có ghi chú."}
      </div>

      <div className="order-detail-actions">
        {order.status === "pending" && (
          <button
            className="order-cancel-btn"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "Đang hủy..." : "Hủy đơn"}
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderCheck;
