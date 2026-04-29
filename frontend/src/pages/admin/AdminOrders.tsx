import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getAllOrders,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "../../services/orderService";
import "./css/admin-orders.css";

// Các trạng thái admin có thể cập nhật (theo thứ tự)
const ADMIN_UPDATABLE_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "processing", label: "Đang xử lý" },
  // { value: "handover_to_carrier", label: "Đã bàn giao vận chuyển" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
];

const ALL_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "processing", label: "Đang xử lý" },
  // { value: "handover_to_carrier", label: "Đã bàn giao vận chuyển" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  // { value: "received", label: "Khách đã nhận" },
  { value: "cancelled", label: "Đã huỷ" },
];

const STATUS_CLASS_MAP: Record<OrderStatus, string> = {
  pending: "warning",
  processing: "warning",
  handover_to_carrier: "info",
  shipping: "info",
  delivered: "success",
  received: "success",
  cancelled: "danger",
};

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>("pending");
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);

  // Lấy danh sách trạng thái có thể chọn dựa trên trạng thái hiện tại và lịch sử
  const getAvailableStatuses = (order: Order): { value: OrderStatus; label: string }[] => {
    const currentStatus = order.status;
    const statusHistory = order.statusHistory || [];
    const passedStatuses = new Set(statusHistory.map(h => h.status));
    // Thêm trạng thái hiện tại vào danh sách đã đi qua
    passedStatuses.add(currentStatus);

    // Nếu đã hủy hoặc đã nhận hàng, không cho cập nhật
    if (currentStatus === "cancelled" || currentStatus === "received") {
      return [];
    }

    // Nếu đang ở pending, chỉ cho chọn processing
    if (currentStatus === "pending") {
      return ADMIN_UPDATABLE_STATUSES.filter(option => option.value === "processing");
    }

    // Lấy các trạng thái admin có thể cập nhật (chưa đi qua)
    const availableStatuses = ADMIN_UPDATABLE_STATUSES.filter(option => {
      // Loại bỏ các trạng thái đã đi qua
      if (passedStatuses.has(option.value)) {
        return false;
      }
      // Chỉ hiển thị các trạng thái tiếp theo trong chuỗi
      const currentIndex = ADMIN_UPDATABLE_STATUSES.findIndex(s => s.value === currentStatus);
      const optionIndex = ADMIN_UPDATABLE_STATUSES.findIndex(s => s.value === option.value);
      // Chỉ cho phép chọn trạng thái tiếp theo
      return optionIndex === currentIndex + 1;
    });

    return availableStatuses;
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllOrders(filter === "all" ? undefined : filter);
      // Sắp xếp đơn hàng mới nhất lên đầu
      const sortedOrders = [...res.data].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Giảm dần (mới nhất lên đầu)
      });
      setOrders(sortedOrders);

      const prevId = selectedOrderIdRef.current;
      let nextSelected: Order | null = null;
      if (!sortedOrders.length) {
        nextSelected = null;
      } else if (prevId) {
        nextSelected =
          sortedOrders.find((o) => o._id === prevId) ?? sortedOrders[0];
      } else {
        nextSelected = sortedOrders[0];
      }

      setSelectedOrder(nextSelected);
      selectedOrderIdRef.current = nextSelected?._id ?? null;
      if (nextSelected) {
        setStatusDraft(nextSelected.status);
      } else {
        setShowModal(false);
      }
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

  const stats = useMemo(() => {
    const base = {
      total: orders.length,
      pending: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      if (["pending", "processing"].includes(order.status)) base.pending++;
      else if (["handover_to_carrier", "shipping"].includes(order.status))
        base.shipping++;
      else if (["delivered", "received"].includes(order.status))
        base.completed++;
      else if (order.status === "cancelled") base.cancelled++;
    });

    return base;
  }, [orders]);

  const summary = useMemo(
    () =>
      ALL_STATUS_OPTIONS.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.value]: orders.filter((order) => order.status === cur.value)
            .length,
        }),
        {} as Record<OrderStatus, number>
      ),
    [orders]
  );

  const formatCurrency = (value: number) =>
    value.toLocaleString("vi-VN") + "đ";

  const addressParts = (order?: Order) =>
    order
      ? [
        order.shippingInfo.address,
        order.shippingInfo.ward,
        order.shippingInfo.district,
        order.shippingInfo.city,
      ]
        .filter((part) => typeof part === "string" && part.trim().length > 0)
        .join(", ")
      : "";

  return (
    <div className="admin-orders">
      <header className="admin-orders__header">
        <div>
          <h1>Quản lý đơn hàng</h1>
        </div>

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

        <div className="admin-orders__chips">
          {ALL_STATUS_OPTIONS.map((option) => (
            <span key={option.value} className="admin-orders__chip">
              {option.label}: <b>{summary[option.value] || 0}</b>
            </span>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="admin-orders__empty">Đang tải đơn hàng...</div>
      ) : orders.length === 0 ? (
        <div className="admin-orders__empty">
          Không có đơn nào trong trạng thái hiện tại.
        </div>
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
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order._id}
                      className={
                        selectedOrder?._id === order._id ? "is-selected" : ""
                      }
                      onClick={() => {
                        setSelectedOrder(order);
                        setStatusDraft(order.status);
                        selectedOrderIdRef.current = order._id;
                        setShowModal(true);
                      }}
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
                          {
                            ALL_STATUS_OPTIONS.find(
                              (s) => s.value === order.status
                            )?.label
                          }
                        </span>
                      </td>
                      <td>
                        {new Date(order.createdAt).toLocaleString("vi-VN")}
                        <button
                          className="admin-orders__view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setStatusDraft(order.status);
                            selectedOrderIdRef.current = order._id;
                            setShowModal(true);
                          }}
                          title="Xem chi tiết đơn"
                        >
                          <i className="fa-regular fa-eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {showModal && selectedOrder && (
        <div className="admin-orders__modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="admin-orders__modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* <div className="admin-orders__modal-header">
              <div>
                <p>Đơn hàng</p>
                <h3>#{selectedOrder.code}</h3>
              </div>
              <button
                className="admin-orders__modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-orders__details-section">
              <h4>Thông tin khách hàng</h4>
              <p>
                <strong>{selectedOrder.shippingInfo.fullName}</strong>
              </p>
              <p>{selectedOrder.shippingInfo.phone}</p>
              <p>{addressParts(selectedOrder)}</p>
            </div>

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
                    <li key={item.productId}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span>
                          {item.name} x {item.quantity}
                        </span>
                        {item.selectedColor && (
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            Màu: {item.selectedColor}
                          </span>
                        )}
                      </div>
                      {hasSale ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
                          <b style={{ color: "#d90019" }}>{formatCurrency(itemTotal)}</b>
                          <span style={{ color: "#999", textDecoration: "line-through", fontSize: "12px" }}>
                            {formatCurrency(itemOldTotal)}
                          </span>
                        </div>
                      ) : (
                        <b style={{ color: "#d90019" }}>{formatCurrency(itemTotal)}</b>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="admin-orders__details-section">
              <h4>Thanh toán</h4>
              {(() => {
                // Tính toán lại từ items nếu totals không có (đơn hàng cũ)
                const calculatedOriginalTotal = selectedOrder.items.reduce(
                  (sum, item) => sum + (item.oldPrice || item.price) * item.quantity,
                  0
                );
                const calculatedTotal = selectedOrder.items.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0
                );
                const calculatedSavings = calculatedOriginalTotal - calculatedTotal;

                // Sử dụng giá trị từ totals nếu có, nếu không thì tính lại
                const subTotal = selectedOrder.totals.subTotal !== undefined ? selectedOrder.totals.subTotal : calculatedTotal;
                const total = selectedOrder.totals.total !== undefined ? selectedOrder.totals.total : calculatedTotal;
                const savings = selectedOrder.totals.savings !== undefined ? selectedOrder.totals.savings : calculatedSavings;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Tạm tính:</span>
                      <span>{formatCurrency(subTotal)}</span>
                    </div>
                    {savings > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#28a745" }}>
                        <span>Tiết kiệm:</span>
                        <span style={{ fontWeight: 600 }}>-{formatCurrency(savings)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, paddingTop: "8px", borderTop: "1px solid #e0e0e0" }}>
                      <span>Thành tiền:</span>
                      <span style={{ color: "#d90019", fontWeight: 600 }}>{formatCurrency(total)}</span>
                    </div>
                    {selectedOrder.totals.discount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(selectedOrder.totals.discount)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Phí vận chuyển:</span>
                      <span>{formatCurrency(selectedOrder.totals.shippingFee)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "16px", paddingTop: "8px", borderTop: "1px solid #e0e0e0" }}>
                      <span>Tổng cộng:</span>
                      <span style={{ color: "#d90019" }}>{formatCurrency(selectedOrder.totals.grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div> */}

            <div className="admin-orders__details-section">
              <h4>Trạng thái đơn</h4>

              <div className="admin-orders__filter-control">
                <select
                  value={statusDraft}
                  onChange={(e) =>
                    setStatusDraft(e.target.value as OrderStatus)
                  }
                  disabled={updatingId === selectedOrder._id}
                >
                  {ALL_STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={
                        option.value !== selectedOrder.status &&
                        !getAvailableStatuses(selectedOrder).some(
                          (s) => s.value === option.value
                        )
                      }
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-orders__modal-actions">
              <button
                className="admin-orders__btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Đóng
              </button>
              <button
                className="admin-orders__btn-primary"
                disabled={
                  statusDraft === selectedOrder.status ||
                  updatingId === selectedOrder._id ||
                  getAvailableStatuses(selectedOrder).length === 0 ||
                  !getAvailableStatuses(selectedOrder).some(s => s.value === statusDraft)
                }
                onClick={() => {
                  if (!selectedOrder) return;
                  handleStatusUpdate(selectedOrder._id, statusDraft);
                  setShowModal(false);
                }}
              >
                {updatingId === selectedOrder._id ? "Đang cập nhật..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
