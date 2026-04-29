import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../user/css/profile.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import {
  getOrdersByUser,
  type Order,
  type OrderStatus,
} from "../../services/orderService";
import { updateProfile } from "../../services/authService";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  handover_to_carrier: "Bàn giao vận chuyển",
  shipping: "Đang giao",
  delivered: "Đã giao",
  received: "Đã nhận",
  cancelled: "Đã huỷ",
};

const Profile: React.FC = () => {
  const { user, isAuth, loading, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập.");
      navigate("/login", { replace: true, state: { redirect: "/profile" } });
      return;
    }

    const fetchOrders = async () => {
      try {
        setStatsLoading(true);
        const res = await getOrdersByUser(user.id);
        setOrders(res.data);
      } catch (error) {
        console.error("fetchOrders profile error:", error);
        toast.error("Không thể tải đơn hàng gần đây.");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchOrders();
  }, [isAuth, user, loading, navigate]);

  const stats = useMemo(() => {
    const summary: Record<OrderStatus, number> = {
      pending: 0,
      processing: 0,
      handover_to_carrier: 0,
      shipping: 0,
      delivered: 0,
      received: 0,
      cancelled: 0,
    };
    orders.forEach((order) => {
      summary[order.status] = (summary[order.status] || 0) + 1;
    });

    return {
      total: orders.length,
      pending: summary.pending + summary.processing,
      shipping: summary.handover_to_carrier + summary.shipping,
      completed: summary.delivered + summary.received,
      cancelled: summary.cancelled,
      raw: summary,
    };
  }, [orders]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập họ tên.");
      return;
    }
    try {
      setSaving(true);
      const res = await updateProfile({
        name: form.name,
        phone: form.phone,
        address: form.address,
      });
      const updatedUser = res.data.user;
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      toast.success("Đã cập nhật hồ sơ.");
    } catch (error: any) {
      console.error("update profile error:", error);
      toast.error(error.response?.data?.message || "Không thể cập nhật.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Đã đăng xuất.");
    navigate("/login");
  };

  if (loading) {
    return <div className="profile-main">Đang tải thông tin...</div>;
  }

  return (
    <div className="profile-main">
      <div className="profile-header">
        <div>
          <p className="profile-breadcrumb">
            <span onClick={() => navigate("/home")}>Trang chủ</span> / Hồ sơ
          </p>
          <h1>Xin chào, {user?.name || "người dùng"}</h1>
          <p className="profile-subtitle">
            Quản lý thông tin cá nhân, sổ địa chỉ và tình trạng đơn hàng tại
            đây.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card profile-card--form">
          <div className="profile-card-header">
            <div>
              <h2>Thông tin cá nhân</h2>
              <p>Cập nhật dữ liệu giúp giao hàng nhanh và chính xác hơn.</p>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Họ và tên
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
            <div className="profile-field-grid">
              <label>
                Email
                <input type="email" name="email" value={form.email} readOnly />
              </label>
              <label>
                Số điện thoại
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </label>
            </div>
            <label>
              Địa chỉ mặc định
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
              />
            </label>
            <button type="submit" className="profile-save-btn" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>
        </section>

        <section className="profile-card profile-card--stats">
          <div className="profile-card-header">
            <div>
              <h2>Lịch sử đơn hàng</h2>
              <p>Theo dõi trạng thái đơn và tình hình giao nhận.</p>
            </div>
            <button className="profile-link" onClick={() => navigate("/orders")}>
              Xem tất cả
            </button>
          </div>
          {statsLoading ? (
            <p>Đang tải...</p>
          ) : (
            <>
              <div className="profile-stats">
                <div>
                  <p>Tổng đơn</p>
                  <strong>{stats.total}</strong>
                </div>
                <div>
                  <p>Đang xử lý</p>
                  <strong>{stats.pending}</strong>
                </div>
                <div>
                  <p>Đang giao</p>
                  <strong>{stats.shipping}</strong>
                </div>
                <div>
                  <p>Hoàn tất</p>
                  <strong>{stats.completed}</strong>
                </div>
              </div>
              <ul className="profile-status-pills">
                {(Object.keys(stats.raw) as OrderStatus[])
                  .filter((key) => key !== "shipping" && key !== "delivered")
                  .map((key) => (
                    <li key={key}>
                      <span>{STATUS_LABELS[key]}</span>
                      <b>{stats.raw[key]}</b>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="profile-grid">
        <section className="profile-card profile-card--recent">
          <div className="profile-card-header">
            <h2>Đơn hàng gần đây</h2>
            <p>3 đơn mới nhất của bạn.</p>
          </div>
          {orders.slice(0, 3).map((order) => (
            <div className="profile-order-item" key={order._id}>
              <div>
                <p className="profile-order-code">#{order.code}</p>
                <p className="profile-order-meta">
                  {new Date(order.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <div className={`profile-order-status profile-order-status--${order.status}`}>
                {STATUS_LABELS[order.status]}
              </div>
              <div className="profile-order-total">
                {order.totals.grandTotal.toLocaleString()}đ
              </div>
            </div>
          ))}
          {!orders.length && <p>Bạn chưa có đơn hàng nào.</p>}
        </section>

        <section className="profile-card profile-card--security">
          <div className="profile-card-header">
            <h2>Bảo mật & đăng nhập</h2>
            <p>Giữ an toàn cho tài khoản của bạn.</p>
          </div>
          <div className="profile-security-list">
            <div className="profile-security-item">
              <div>
                <h4>Mật khẩu</h4>
                <p>Khuyến nghị đổi mật khẩu mỗi 90 ngày.</p>
              </div>
              <button onClick={() => navigate("/forgotpass")}>Đổi mật khẩu</button>
            </div>
            <div className="profile-security-item">
              <div>
                <h4>Đăng nhập</h4>
                <p>Email đăng nhập: {user?.email}</p>
              </div>
              <button onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Profile;

