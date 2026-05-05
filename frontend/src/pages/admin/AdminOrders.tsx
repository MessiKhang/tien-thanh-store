import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getAllOrders,
  updateOrderStatus,
  deleteOrder,          // ← add this export to your orderService
  type Order,
  type OrderStatus,
} from "../../services/orderService";
import "./css/admin-orders.css";

const ADMIN_UPDATABLE_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "processing", label: "Đang xử lý" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
];

const ALL_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "processing", label: "Đang xử lý" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã huỷ" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Thanh toán khi nhận hàng (COD)",
  momo: "Ví MoMo",
  zalopay: "ZaloPay",
  payoo: "Payoo",
};

/** Orders that can be deleted by admin */
const DELETABLE_STATUSES: OrderStatus[] = ["pending", "cancelled"];

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>("pending");
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);

  const getAvailableStatuses = (order: Order): { value: OrderStatus; label: string }[] => {
    const currentStatus = order.status;
    const passedStatuses = new Set((order.statusHistory || []).map((h) => h.status));
    passedStatuses.add(currentStatus);

    if (currentStatus === "cancelled" || currentStatus === "received") return [];
    if (currentStatus === "pending") {
      return ADMIN_UPDATABLE_STATUSES.filter((o) => o.value === "processing");
    }
    return ADMIN_UPDATABLE_STATUSES.filter((option) => {
      if (passedStatuses.has(option.value)) return false;
      const currentIndex = ADMIN_UPDATABLE_STATUSES.findIndex((s) => s.value === currentStatus);
      const optionIndex = ADMIN_UPDATABLE_STATUSES.findIndex((s) => s.value === option.value);
      return optionIndex === currentIndex + 1;
    });
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllOrders(filter === "all" ? undefined : filter);
      const sortedOrders = [...res.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sortedOrders);

      const prevId = selectedOrderIdRef.current;
      // Only restore a previously selected row — never auto-select the first row
      const nextSelected = prevId
        ? (sortedOrders.find((o) => o._id === prevId) ?? null)
        : null;

      setSelectedOrder(nextSelected);
      selectedOrderIdRef.current = nextSelected?._id ?? null;
      if (nextSelected) setStatusDraft(nextSelected.status);
      else setShowModal(false);
    } catch (error) {
      console.error("getAllOrders error:", error);
      toast.error("Không thể tải danh sách đơn hàng.");
      setSelectedOrder(null);
      selectedOrderIdRef.current = null;
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ── Status update ──────────────────────────────────────────────
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, status);
      toast.success("Đã cập nhật trạng thái đơn hàng.");
      loadOrders();
    } catch (error) {
      console.error("updateOrderStatus error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể cập nhật.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Delete order ───────────────────────────────────────────────
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Bạn có chắc muốn xoá đơn hàng này không?")) return;
    try {
      setDeletingId(orderId);
      await deleteOrder(orderId);
      toast.success("Đã xoá đơn hàng.");
      // If the deleted order was selected, clear selection
      if (selectedOrderIdRef.current === orderId) {
        selectedOrderIdRef.current = null;
      }
      loadOrders();
    } catch (error) {
      console.error("deleteOrder error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể xoá đơn hàng.");
    } finally {
      setDeletingId(null);
    }
  };


  const formatCurrency = (value: number) => value.toLocaleString("vi-VN") + "đ";

  const addressParts = (order?: Order) =>
    order
      ? [
          order.shippingInfo.address,
          order.shippingInfo.ward,
          order.shippingInfo.district,
          order.shippingInfo.city,
        ]
          .filter((p) => typeof p === "string" && p.trim().length > 0)
          .join(", ")
      : "";

  const openModal = (order: Order) => {
    setSelectedOrder(order);
    setStatusDraft(order.status);
    selectedOrderIdRef.current = order._id;
    setShowModal(true);
  };

  // ── Row click: select + show inline status bar ─────────────────
  const handleRowClick = (order: Order) => {
    if (selectedOrder?._id === order._id) {
      // Toggle off if clicking the already-selected row
      setSelectedOrder(null);
      selectedOrderIdRef.current = null;
    } else {
      setSelectedOrder(order);
      setStatusDraft(order.status);
      selectedOrderIdRef.current = order._id;
    }
  };

  return (
    <div className="admin-orders">
      <header className="admin-orders__header">
        <h1>Quản lý đơn hàng</h1>
      </header>

      <section className="admin-orders__filters">
        <div className="admin-orders__filter-control">
          <label>Trạng thái</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "all")}
          >
            <option value="all">Tất cả</option>
            {ALL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

      </section>

      {loading ? (
        <div className="admin-orders__empty">Đang tải đơn hàng...</div>
      ) : orders.length === 0 ? (
        <div className="admin-orders__empty">Không có đơn nào trong trạng thái hiện tại.</div>
      ) : (
        <div className="admin-orders__content">
          <div className="admin-orders__table-card">
            <div className="admin-orders__table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Tổng</th>
                    <th>Trạng thái</th>
                    <th>Ngày đặt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isSelected = selectedOrder?._id === order._id;
                    const availableStatuses = getAvailableStatuses(order);
                    const canDelete = DELETABLE_STATUSES.includes(order.status);
                    const isUpdating = updatingId === order._id;
                    const isDeleting = deletingId === order._id;

                    return (
                      <React.Fragment key={order._id}>
                        {/* ── Main row ── */}
                        <tr
                          className={isSelected ? "is-selected" : ""}
                          onClick={() => handleRowClick(order)}
                        >
                          <td>#{order.code}</td>
                          <td>
                            <p className="admin-orders__customer-name">
                              {order.shippingInfo.fullName}
                            </p>
                            <span>{order.shippingInfo.phone}</span>
                          </td>
                          <td>{formatCurrency(order.totals.grandTotal)}</td>
                          <td>
                            <span
                              className={`admin-orders__status-badge admin-orders__status-badge--${order.status}`}
                            >
                              {ALL_STATUS_OPTIONS.find((s) => s.value === order.status)?.label}
                            </span>
                          </td>
                          <td>
                            {new Date(order.createdAt).toLocaleString("vi-VN")}
                            {/* Eye → full detail modal */}
                            <button
                              className="admin-orders__view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal(order);
                              }}
                              title="Xem chi tiết đơn"
                            >
                              <i className="fa-regular fa-eye" />
                            </button>
                          </td>
                          {/* Delete column */}
                          <td onClick={(e) => e.stopPropagation()}>
                            {canDelete && (
                              <button
                                className="admin-orders__delete-btn"
                                title="Xoá đơn hàng"
                                disabled={isDeleting}
                                onClick={() => handleDeleteOrder(order._id)}
                              >
                                {isDeleting
                                  ? <i className="fa-solid fa-spinner fa-spin" />
                                  : <i className="fa-regular fa-trash-can" />}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* ── Inline status-update bar (row click) ── */}
                        {isSelected && availableStatuses.length > 0 && (
                          <tr className="admin-orders__inline-update-row">
                            <td colSpan={6}>
                              <div className="admin-orders__inline-update">
                                <span className="admin-orders__inline-update-label">
                                  Cập nhật trạng thái:
                                </span>
                                <select
                                  value={statusDraft}
                                  onChange={(e) =>
                                    setStatusDraft(e.target.value as OrderStatus)
                                  }
                                  disabled={isUpdating}
                                >
                                  {ALL_STATUS_OPTIONS.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      disabled={
                                        option.value !== order.status &&
                                        !availableStatuses.some((s) => s.value === option.value)
                                      }
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="admin-orders__btn-primary admin-orders__inline-update-btn"
                                  disabled={
                                    statusDraft === order.status ||
                                    isUpdating ||
                                    !availableStatuses.some((s) => s.value === statusDraft)
                                  }
                                  onClick={() => handleStatusUpdate(order._id, statusDraft)}
                                >
                                  {isUpdating ? "Đang cập nhật..." : "Cập nhật"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL (eye icon only) ── */}
      {showModal && selectedOrder && (
        <div className="admin-orders__modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="admin-orders__modal" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="admin-orders__modal-header">
              <div>
                <p>Đơn hàng</p>
                <h3>#{selectedOrder.code}</h3>
              </div>
              <button className="admin-orders__modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            {/* Customer info */}
            <div className="admin-orders__details-section">
              <h4>Thông tin khách hàng</h4>
              <p><strong>{selectedOrder.shippingInfo.fullName}</strong></p>
              <p>{selectedOrder.shippingInfo.phone}</p>
              {selectedOrder.shippingInfo.email && <p>{selectedOrder.shippingInfo.email}</p>}
              <p>{addressParts(selectedOrder)}</p>
              <p>
                <strong>Thanh toán:</strong>{" "}
                {PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod] ?? selectedOrder.paymentMethod}
              </p>
              {selectedOrder.shippingInfo.note && (
                <p><strong>Ghi chú:</strong> {selectedOrder.shippingInfo.note}</p>
              )}
            </div>

            {/* Product list */}
            <div className="admin-orders__details-section">
              <h4>Sản phẩm ({selectedOrder.items.length})</h4>
              <ul>
                {selectedOrder.items.map((item) => {
                  const itemPrice = item.price;
                  const itemOldPrice = item.oldPrice || item.price;
                  const hasSale = itemOldPrice > itemPrice && itemOldPrice > 0;
                  const itemTotal = itemPrice * item.quantity;
                  const itemOldTotal = hasSale ? itemOldPrice * item.quantity : itemTotal;

                  return (
                    <li
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "8px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        {item.image && (
                          <img
                            src={item.image.startsWith("http") ? item.image : `http://localhost:5000/${item.image}`}
                            alt={item.name}
                            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                          {item.selectedColor && (
                            <div style={{ fontSize: 12, color: "#666" }}>Màu: {item.selectedColor}</div>
                          )}
                          <div style={{ fontSize: 12, color: "#999" }}>x{item.quantity}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#d90019", fontWeight: 600 }}>{formatCurrency(itemTotal)}</div>
                        {hasSale && (
                          <div style={{ color: "#999", textDecoration: "line-through", fontSize: 12 }}>
                            {formatCurrency(itemOldTotal)}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Payment breakdown */}
            <div className="admin-orders__details-section">
              <h4>Thanh toán</h4>
              {(() => {
                const subTotal = selectedOrder.totals.subTotal ?? 0;
                const total = selectedOrder.totals.total ?? 0;
                const savings = selectedOrder.totals.savings ?? 0;
                const row = (label: string, value: string, bold = false, color?: string) => (
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 700 : 400, fontSize: bold ? 15 : 14, paddingTop: bold ? 6 : 0, borderTop: bold ? "1px solid #eee" : "none" }}>
                    <span>{label}</span>
                    <span style={color ? { color } : {}}>{value}</span>
                  </div>
                );
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {row("Tạm tính:", formatCurrency(subTotal))}
                    {savings > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#28a745", fontSize: 14 }}>
                        <span>Tiết kiệm:</span><span>-{formatCurrency(savings)}</span>
                      </div>
                    )}
                    {row("Thành tiền:", formatCurrency(total), true, "#d90019")}
                    {selectedOrder.totals.discount > 0 &&
                      row("Giảm giá (voucher):", `-${formatCurrency(selectedOrder.totals.discount)}`)}
                    {row("Phí vận chuyển:", formatCurrency(selectedOrder.totals.shippingFee))}
                    {row("Tổng cộng:", formatCurrency(selectedOrder.totals.grandTotal), true, "#d90019")}
                  </div>
                );
              })()}
            </div>

            {/* Modal actions — view only, no status update here */}
            <div className="admin-orders__modal-actions">
              <button className="admin-orders__btn-secondary" onClick={() => setShowModal(false)}>
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;