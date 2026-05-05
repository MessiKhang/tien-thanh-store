import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/order-success.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../../context/AuthContext";
import { getOrderDetail, type Order } from "../../services/orderService";
import { toast } from "sonner";

const safeDecodeURI = (str: string): string => {
  try { return decodeURIComponent(str); } catch { return str; }
};

const OrderSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuth, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const orderId    = searchParams.get("orderId");
  const error      = searchParams.get("error");
  const transId    = searchParams.get("transId");
  const resultCode = searchParams.get("resultCode");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập.");
      navigate("/login", { replace: true });
      return;
    }

    if (!orderId && !error) {
      navigate("/home", { replace: true });
      return;
    }

    if (resultCode && resultCode !== "0") {
      const message = searchParams.get("message") || "Thanh toán thất bại";
      toast.error(safeDecodeURI(message));
      navigate("/checkout", { replace: true });
      return;
    }

    if (orderId?.startsWith("TEMP_")) {
      toast.error("Thanh toán chưa hoàn tất. Vui lòng thử lại.");
      navigate("/checkout", { replace: true });
      return;
    }

    if (error) {
      toast.error(safeDecodeURI(error));
      navigate("/checkout", { replace: true });
      return;
    }

    if (orderId) {
      let cancelled = false;
      const loadOrder = async () => {
        try {
          setLoading(true);
          const res = await getOrderDetail(orderId);
          if (cancelled) return;

          if (res.data.status === "awaiting_payment") {
            toast.warning("Đơn hàng chưa được thanh toán.");
            navigate("/checkout", { replace: true });
            return;
          }

          setOrder(res.data);

          // FIX: read paymentMethod from fetched data, not from stale order state
          if (transId && !error) {
            const method = res.data.paymentMethod === "zalopay" ? "ZaloPay"
                         : res.data.paymentMethod === "momo"     ? "MoMo"
                         : res.data.paymentMethod.toUpperCase();
            toast.success(`Thanh toán ${method} thành công!`);
          }
        } catch (err) {
          console.error("getOrderDetail error:", err);
          if (!cancelled) {
            toast.error("Không thể tải thông tin đơn hàng.");
            navigate("/checkout", { replace: true });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      loadOrder();
      return () => { cancelled = true; };
    } else {
      setLoading(false);
    }
  }, [orderId, error, transId, resultCode, isAuth, user, authLoading, navigate, searchParams]);

  if (loading || authLoading) {
    return (
      <div className="order-success-main">
        <div className="order-success-container">Đang tải...</div>
      </div>
    );
  }

  const isCancelled = order?.status === "cancelled";
  const hasError    = error || isCancelled;

  return (
    <div className="order-success-main">
      <div className="order-success-container">
        <div className="order-success-header">
          {hasError ? (
            <>
              <div className="order-success-icon" style={{ background: "linear-gradient(135deg, #dc3545 0%, #c82333 100%)", boxShadow: "0 4px 15px rgba(220,53,69,0.3)" }}>
                <i className="fa fa-times"></i>
              </div>
              <h1 className="order-success-title" style={{ color: "#dc3545" }}>
                {isCancelled ? "Đơn hàng đã bị hủy!" : "Thanh toán thất bại!"}
              </h1>
              <p className="order-success-message">
                {isCancelled
                  ? "Đơn hàng của bạn đã bị hủy do thanh toán không thành công."
                  : safeDecodeURI(error || "Có lỗi xảy ra trong quá trình thanh toán.")}
              </p>
            </>
          ) : (
            <>
              <div className="order-success-icon">
                <i className="fa fa-check"></i>
              </div>
              <h1 className="order-success-title">Đặt hàng thành công!</h1>
              <p className="order-success-message">
                Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đã được tiếp nhận và đang được xử lý.
              </p>
            </>
          )}
        </div>

        <div className="order-success-actions">
          {hasError ? (
            <>
              <Link to="/checkout" className="order-success-btn order-success-btn-primary">
                <i className="fa fa-shopping-cart"></i> Quay lại giỏ hàng
              </Link>
              <Link to="/home" className="order-success-btn order-success-btn-secondary">
                <i className="fa fa-home"></i> Về trang chủ
              </Link>
            </>
          ) : (
            <Link to="/home" className="order-success-btn order-success-btn-secondary">
              <i className="fa fa-home"></i> Về trang chủ
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;