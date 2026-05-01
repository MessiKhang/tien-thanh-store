import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../user/css/checkout.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import logo from "../img/logo.png";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import {
  createOrder,
  createMomoPayment,
  type ShippingInfo,
} from "../../services/orderService";
import { validateCoupon } from "../../services/couponService";
type CartProduct = {
  _id: string;
  name: string;
  image: string;
  price: number | string | { $numberDecimal?: string };
  oldPrice?: number | string | { $numberDecimal?: string };
};

type CartItem = {
  productId: CartProduct;
  quantity: number;
  selectedColor?: string; // Màu sắc đã chọn
};

type CartResponse = {
  items: CartItem[];
};

const PAYMENT_OPTIONS = [
  { value: "cod", label: "Thanh toán khi giao hàng (COD)" },
  { value: "momo", label: "Thanh toán qua MOMO" },
];

const Checkout: React.FC = () => {
  const { user, isAuth, loading: authLoading, refreshCartCount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingFee] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [form, setForm] = useState<ShippingInfo>({
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    address: user?.address || "",
    note: "",
  });

  // Xử lý error từ MoMo callback
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(decodeURIComponent(error));
      // Xóa query params
      window.history.replaceState({}, document.title, "/checkout");
    }
  }, [searchParams]);

  const toNumber = (
    value: number | string | { $numberDecimal?: string } | undefined
  ) => {
    if (!value && value !== 0) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || 0;
    if (typeof value === "object" && value.$numberDecimal) {
      return parseFloat(value.$numberDecimal || "0") || 0;
    }
    return 0;
  };

  const fetchCart = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await axios.get<CartResponse>(
        `http://localhost:5000/api/cart/${user.id}`
      );
      setCart(res.data);
    } catch (error) {
      console.error("fetchCart error:", error);
      toast.error("Không thể tải giỏ hàng.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập trước khi thanh toán.");
      navigate("/login", { replace: true, state: { redirect: "/checkout" } });
      return;
    }
    fetchCart();
  }, [authLoading, isAuth, user, fetchCart, navigate]);


  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      fullName: user?.name || prev.fullName,
      phone: user?.phone || prev.phone,
      email: user?.email || prev.email,
      address: user?.address || prev.address,
    }));
  }, [user]);

  const totals = useMemo(() => {
    if (!cart?.items?.length) {
      return { subTotal: 0, total: 0, grandTotal: 0, savings: 0 };
    }

    // Tổng tiền gốc (để tính tiết kiệm)
    const originalTotal = cart.items.reduce((sum: number, item: CartItem) => {
      const price = toNumber(item.productId.price);
      const oldPrice = toNumber(item.productId.oldPrice);
      const hasSale = oldPrice > price && oldPrice > 0;
      return sum + (hasSale ? oldPrice : price) * item.quantity;
    }, 0);

    // Tạm tính (tính theo giá giảm - giá sau khi sale)
    const subTotal = cart.items.reduce(
      (sum: number, item: CartItem) =>
        sum + toNumber(item.productId.price) * item.quantity,
      0
    );

    // Tiết kiệm = tổng tiền gốc - tổng tiền giảm
    const savings = originalTotal - subTotal;

    // Thành tiền = tổng tiền giá giảm (trước khi áp voucher)
    const total = subTotal;

    const couponDiscount = appliedCoupon?.discount || 0;

    return {
      subTotal, // Tạm tính (giá giảm)
      total, // Thành tiền (giá giảm - trước voucher)
      savings, // Tiết kiệm
      couponDiscount, // Giảm từ mã giảm giá
      grandTotal: Math.max(total + shippingFee - couponDiscount, 0), // Tổng cộng (thành tiền + phí ship - mã giảm giá)
    };
  }, [cart, shippingFee, appliedCoupon]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Vui lòng nhập mã giảm giá");
      return;
    }

    if (!totals.total) {
      toast.error("Giỏ hàng trống");
      return;
    }

    try {
      setValidatingCoupon(true);
      const res = await validateCoupon(couponCode.trim(), totals.total);
      if (res.success && res.data) {
        setAppliedCoupon({
          code: res.data.coupon.code,
          discount: res.data.discount,
        });
        toast.success(`Áp dụng mã "${res.data.coupon.code}" thành công!`);
      }
    } catch (error: unknown) {
      console.error("validateCoupon error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      const message =
        err.response?.data?.message || "Mã giảm giá không hợp lệ";
      toast.error(message);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    toast.success("Đã xóa mã giảm giá");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!cart?.items?.length) {
      toast.error("Giỏ hàng trống, không thể đặt hàng.");
      return;
    }
    if (!form.fullName || !form.phone || !form.address) {
      toast.error("Vui lòng nhập đầy đủ thông tin giao hàng.");
      return;
    }

    try {
      setPlacing(true);

      // Nếu thanh toán MOMO
      if (paymentMethod === "momo") {
        // Kiểm tra grandTotal hợp lệ
        const grandTotal = Number(totals.grandTotal);
        if (!grandTotal || grandTotal <= 0 || isNaN(grandTotal)) {
          toast.error("Số tiền thanh toán không hợp lệ. Vui lòng kiểm tra lại giỏ hàng.");
          setPlacing(false);
          return;
        }

        // Chuẩn bị dữ liệu đơn hàng (KHÔNG tạo order ngay)
        const orderData = {
          userId: user.id,
          shippingInfo: form,
          paymentMethod: "momo",
          shippingFee,
          discount: appliedCoupon?.discount || 0,
          couponCode: appliedCoupon?.code || undefined,
          items: cart.items.map((item: CartItem) => ({
          productId: item.productId._id,
          name: item.productId.name,
          image: item.productId.image,
          price: toNumber(item.productId.price),
          oldPrice: toNumber(item.productId.oldPrice) || toNumber(item.productId.price),
          quantity: item.quantity,
          selectedColor: item.selectedColor || "",
        })),
        };

        // Tạo payment URL từ MOMO (gửi orderData thay vì orderId)
        const momoResponse = await createMomoPayment(grandTotal, orderData);

        if (momoResponse.success && momoResponse.payUrl) {
          // Redirect đến trang thanh toán MOMO
          await refreshCartCount(user?.id);
          window.location.href = momoResponse.payUrl;
          return;
        } else {
          toast.error(momoResponse.message || "Không thể tạo link thanh toán MOMO");
          setPlacing(false);
          return;
        }
      }

      // Thanh toán COD
      const response = await createOrder({
        userId: user.id,
        shippingInfo: form,
        paymentMethod,
        shippingFee,
        couponCode: appliedCoupon?.code || undefined,
        discount: appliedCoupon?.discount || 0,
      });

      toast.success("Đặt hàng thành công!");
      navigate(`/order-success?orderId=${response.data._id}`);
    } catch (error) {
      console.error("placeOrder error:", error);
      const err = error as { response?: { data?: { message?: string; success?: boolean } } };
      const message =
        err.response?.data?.message || "Không thể đặt hàng. Thử lại sau.";
      toast.error(message);
      
      // Log chi tiết để debug
      if (err.response?.data) {
        console.error("Error details:", err.response.data);
      }
    } finally {
      setPlacing(false);
    }
  };

  if (loading || authLoading) {
    return <div className="checkout-main">Đang tải dữ liệu...</div>;
  }

  const cartCount = cart?.items?.length || 0;

  return (
    <div className="checkout-main">
      <div className="checkout-container">
        <div className="checkout-header">
          <img src={logo} alt="Logo" className="checkout-logo" />
          <div className="checkout-breadcrumb">
            <Link to="/home">Trang chủ</Link>
            <span>&gt;</span>
            <Link to="/cart">Giỏ hàng</Link>
            <span>&gt;</span>
            <span className="active">Thông tin thanh toán</span>
          </div>
          <div className="checkout-steps">
            <div className="checkout-step active">
              <span>1</span>
              <p>Giỏ hàng</p>
            </div>
            <div className={`checkout-step ${cartCount ? "active" : ""}`}>
              <span>2</span>
              <p>Địa chỉ & Thanh toán</p>
            </div>
            <div className="checkout-step">
              <span>3</span>
              <p>Hoàn tất</p>
            </div>
          </div>
        </div>

        <form className="checkout-body" onSubmit={handlePlaceOrder}>
          <div className="checkout-left">
            <section className="checkout-card checkout-card--info">
              <div className="checkout-card-heading">
                <div>
                  <h3>Thông tin giao hàng</h3>
                  <p>Điền chính xác để giao nhanh chóng.</p>
                </div>
                <span className="checkout-chip">
                  <i className="fa-regular fa-user"></i> {user?.name}
                </span>
              </div>
              <div className="checkout-form">
                <div className="field-grid">
                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={handleChange}
                    />
                  </label>
                  <label>
                    Số điện thoại
                    <input
                      type="text"
                      name="phone"
                      placeholder="Số điện thoại"
                      value={form.phone}
                      onChange={handleChange}
                      required
                    />
                  </label>
                </div>
                <label>
                  Họ và tên
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Họ và tên"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />
                </label>
                <label>
                  Địa chỉ chi tiết
                  <input
                    type="text"
                    name="address"
                    placeholder="Ví dụ: 85 Lê Lợi, P. Bến Nghé"
                    value={form.address}
                    onChange={handleChange}
                    required
                  />
                </label>
                <label>
                  Ghi chú giao hàng
                  <textarea
                    name="note"
                    placeholder="Ghi chú (tùy chọn)"
                    value={form.note}
                    onChange={handleChange}
                    rows={3}
                  />
                </label>
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-heading">
                <div>
                  <h3>Phương thức thanh toán</h3>
                  <p>Chọn phương thức thanh toán phù hợp với bạn.</p>
                </div>
              </div>
              <div className="checkout-payment-list">
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option.value} className="checkout-payment-item">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="checkout-pay-radio"></span>
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="checkout-shipping-preview">
                <p>Giao tới</p>
                <strong>{form.fullName || "Chưa có tên"}</strong>
                <span>{form.address || "Chưa có địa chỉ"}</span>
                <span>{form.phone}</span>
                {form.note && <span>Ghi chú: {form.note}</span>}
              </div>
            </section>
          </div>

          <div className="checkout-right">
            <section className="checkout-card checkout-summary-card">
              <div className="checkout-order-title">
                Đơn hàng <span>({cartCount} sản phẩm)</span>
              </div>
              <div className="checkout-order-list">
                {cart?.items?.map((item) => {
                  const product = item.productId;
                  const price = toNumber(product.price);
                  const oldPrice = toNumber(product.oldPrice);
                  const hasSale = oldPrice > price && oldPrice > 0;
                  const itemTotal = price * item.quantity;
                  const itemOldTotal = hasSale ? oldPrice * item.quantity : itemTotal;
                  return (
                    <div className="checkout-order-item" key={product._id}>
                      <img src={product.image} alt={product.name} />
                      <div>
                        <div className="checkout-order-name">{product.name}</div>
                        {item.selectedColor && (
                          <div className="checkout-order-sub" style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                            Màu: {item.selectedColor}
                          </div>
                        )}
                        <div className="checkout-order-sub">
                          Số lượng: {item.quantity}
                        </div>
                      </div>
                      <div className="checkout-order-price">
                        {hasSale ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                            <span style={{ color: "#d90019", fontWeight: 600 }}>
                              {itemTotal.toLocaleString()}₫
                            </span>
                            <span style={{ color: "#999", textDecoration: "line-through", fontSize: "12px" }}>
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
                {!cartCount && (
                  <p style={{ padding: "16px 0" }}>Giỏ hàng của bạn trống.</p>
                )}
              </div>

              <div className="checkout-order-note">
                {appliedCoupon ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                    <span style={{ flex: 1, color: "#0369a1", fontWeight: 600 }}>
                      Mã: {appliedCoupon.code} (-{appliedCoupon.discount.toLocaleString()}₫)
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      style={{
                        padding: "6px 12px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Nhập mã giảm giá (nếu có)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                    />
                    <button
                      className="checkout-order-note-btn"
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                    >
                      {validatingCoupon ? "Đang kiểm tra..." : "Áp dụng"}
                    </button>
                  </>
                )}
              </div>

              <div className="checkout-order-sum">
                <div className="checkout-sum-row">
                  <span>Tạm tính</span>
                  <span>{totals.subTotal.toLocaleString()}₫</span>
                </div>
                {totals.savings > 0 && (
                  <div className="checkout-sum-row" style={{ color: "#28a745" }}>
                    <span>Tiết kiệm</span>
                    <span style={{ color: "#28a745", fontWeight: 600 }}>
                      -{totals.savings.toLocaleString()}₫
                    </span>
                  </div>
                )}
                <div className="checkout-sum-row" style={{ fontWeight: 600, paddingTop: "8px", borderTop: "1px solid #e0e0e0" }}>
                  <span>Thành tiền</span>
                  <span style={{ color: "#d90019", fontWeight: 600 }}>
                    {totals.total.toLocaleString()}₫
                  </span>
                </div>
                {totals.couponDiscount && totals.couponDiscount > 0 && (
                  <div className="checkout-sum-row" style={{ color: "#dc2626" }}>
                    <span>Mã giảm giá</span>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                      -{totals.couponDiscount.toLocaleString()}₫
                    </span>
                  </div>
                )}
                <div className="checkout-sum-row">
                  <span>Phí vận chuyển</span>
                  <span>{shippingFee.toLocaleString()}₫</span>
                </div>
                <div className="checkout-sum-row checkout-sum-row-total">
                  <span>Tổng cộng</span>
                  <span className="checkout-order-total">
                    {totals.grandTotal.toLocaleString()}₫
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  type="submit"
                  className="checkout-btn-order"
                  disabled={placing || !cartCount}
                >
                  {placing ? "Đang xử lý..." : "Đặt hàng ngay"}
                </button>
                <Link
                  to="/cart"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "12px",
                    background: "#f5f5f5",
                    color: "#333",
                    textDecoration: "none",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    fontWeight: 500,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e8e8e8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f5f5f5";
                  }}
                >
                  <i className="fa fa-arrow-left" style={{ marginRight: "8px" }}></i>
                  Quay lại giỏ hàng
                </Link>
              </div>

              <div className="checkout-safe-note">
                <i className="fa fa-shield-heart"></i>
                <p>Thông tin thanh toán của bạn được bảo mật.</p>
              </div>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
