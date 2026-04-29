import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/order.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../../context/AuthContext";
import {
  getOrdersByUser,
  cancelOrder,
  type Order,
  type OrderStatus,
} from "../../services/orderService";
import { toast } from "sonner";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  handover_to_carrier: "Đã xác nhận đơn hàng",
  shipping: "Đã xác nhận đơn hàng",
  delivered: "Đã giao hàng thành công",
  received: "Đã giao hàng thành công",
  cancelled: "Đã Hủy",
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

const Orders: React.FC = () => {
  const { user, isAuth, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "all">("all");
  const [fetching, setFetching] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập để xem đơn hàng.");
      navigate("/login", { replace: true, state: { redirect: "/orders" } });
      return;
    }
    const load = async () => {
      try {
        setFetching(true);
        const res = await getOrdersByUser(user.id);
        setOrders(res.data);
      } catch (error) {
        console.error("getOrders error:", error);
        toast.error("Không thể tải đơn hàng.");
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [isAuth, user, loading, navigate]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === "all") return orders;
    if (activeStatus === "delivered") {
      return orders.filter((order) => order.status === "delivered" || order.status === "received");
    }
    return orders.filter((order) => order.status === activeStatus);
  }, [orders, activeStatus]);

  const handleCancel = async (orderId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) {
      return;
    }
    try {
      setCancellingId(orderId);
      await cancelOrder(orderId);
      toast.success("Đã hủy đơn hàng thành công!");
      setOrders((prev) =>
        prev.map((order) =>
          order._id === orderId
            ? { ...order, status: "cancelled" }
            : order
        )
      );
    } catch (error) {
      console.error("cancel error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể hủy đơn hàng.");
    } finally {
      setCancellingId(null);
    }
  };

  if (loading || fetching) {
    return <div className="order-main">Đang tải đơn hàng...</div>;
  }

  return (
    <div className="order-main">
      <div className="breadcrumb">
        <Link to="/home">Trang chủ</Link> <span>&gt;</span>{" "}
        <span className="breadcrumb-current">Đơn hàng của tôi</span>
      </div>

      <div className="order-header">
        <h1>Lịch sử đơn hàng</h1>
        <div className="order-tabs">
          <button
            className={`order-tab ${activeStatus === "all" ? "active" : ""}`}
            onClick={() => setActiveStatus("all")}
          >
            Tất cả
          </button>
          <button
            className={`order-tab ${activeStatus === "pending" ? "active" : ""}`}
            onClick={() => setActiveStatus("pending")}
          >
            Chờ xác nhận
          </button>
          <button
            className={`order-tab ${activeStatus === "processing" ? "active" : ""}`}
            onClick={() => setActiveStatus("processing")}
          >
            Đang xử lý
          </button>
          <button
            className={`order-tab ${activeStatus === "delivered" || activeStatus === "received" ? "active" : ""}`}
            onClick={() => {
              const filtered = orders.filter(o => o.status === "delivered" || o.status === "received");
              if (filtered.length > 0) {
                setActiveStatus("delivered" as OrderStatus);
              }
            }}
          >
            Đã giao hàng thành công
          </button>
          <button
            className={`order-tab ${activeStatus === "cancelled" ? "active" : ""}`}
            onClick={() => setActiveStatus("cancelled")}
          >
            Đã Hủy
          </button>
        </div>
      </div>

      <div className="order-list">
        {filteredOrders.length === 0 && (
          <div className="order-empty">
            <p>Không có đơn hàng nào.</p>
            <Link to="/home" className="btn btn-primary">
              Mua sắm ngay
            </Link>
          </div>
        )}

        {filteredOrders.map((order) => (
          <div className="order-card" key={order._id}>
            <div className="order-info">
              <div className="order-row">
                <span className="order-code">
                  Mã đơn: <b>#{order.code}</b>
                </span>
                <span
                  className={`order-status ${STATUS_CLASS[order.status] || ""}`}
                >
                  <i className="fa fa-info-circle"></i>{" "}
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="order-row">
                <span className="order-date">
                  <i className="fa fa-calendar-alt"></i>{" "}
                  {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                </span>
                <span className="order-total">
                  Tổng: <b>{order.totals.grandTotal.toLocaleString()}đ</b>
                </span>
              </div>
            </div>

            <div className="order-products">
              {order.items.slice(0, 2).map((item) => (
                <div className="order-product-item" key={item.productId}>
                  <img src={item.image} alt={item.name} />
                  <div className="order-product-info">
                    <div className="order-product-name">{item.name}</div>
                    {item.selectedColor && (
                      <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
                        Màu: {item.selectedColor}
                      </div>
                    )}
                    <div className="order-product-qty">
                      Số lượng: {item.quantity}
                    </div>
                  </div>
                  <div className="order-product-price">
                    {(item.price * item.quantity).toLocaleString()}₫
                  </div>
                </div>
              ))}
              {order.items.length > 2 && (
                <div className="order-more">
                  +{order.items.length - 2} sản phẩm khác
                </div>
              )}
            </div>

            <div className="order-action">
              <button
                className="order-detail-btn"
                onClick={() => navigate(`/orders/${order._id}`)}
              >
                <i className="fa fa-eye"></i> Xem chi tiết
              </button>
              {order.status === "pending" && (
                <button
                  className="order-cancel-btn"
                  onClick={() => handleCancel(order._id)}
                  disabled={cancellingId === order._id}
                >
                  {cancellingId === order._id
                    ? "Đang hủy..."
                    : "Hủy đơn"}
                </button>
              )}
              {/* Ẩn nút hủy khi trạng thái là đang xử lí */}
              
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
