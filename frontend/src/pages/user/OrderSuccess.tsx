import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/order-success.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../../context/AuthContext";
import { getOrderDetail, type Order } from "../../services/orderService";
import { toast } from "sonner";

const OrderSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuth, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const orderId = searchParams.get("orderId");
  const error = searchParams.get("error");
  const transId = searchParams.get("transId");
  const resultCode = searchParams.get("resultCode"); // MoMo result code

  useEffect(() => {
    if (authLoading) return;
    if (!isAuth || !user) {
      toast.error("Vui lòng đăng nhập.");
      navigate("/login", { replace: true });
      return;
    }

    // Kiểm tra resultCode từ MoMo (0 = thành công)
    if (resultCode && resultCode !== "0") {
      const message = searchParams.get("message") || "Thanh toán thất bại";
      toast.error(decodeURIComponent(message));
      navigate("/checkout", { replace: true });
      return;
    }

    // Kiểm tra nếu orderId là TEMP_ (orderId tạm của MoMo) → redirect về checkout
    if (orderId && orderId.startsWith("TEMP_")) {
      toast.error("Thanh toán chưa hoàn tất. Vui lòng thử lại.");
      navigate("/checkout", { replace: true });
      return;
    }

    // Xử lý lỗi từ callback MOMO
    if (error) {
      toast.error(decodeURIComponent(error));
      navigate("/checkout", { replace: true });
      return;
    }

    // Nếu có orderId từ query params, load order detail
    if (orderId) {
      const loadOrder = async () => {
        try {
          setLoading(true);
          const res = await getOrderDetail(orderId);
          setOrder(res.data);
          // Nếu có transId (từ MOMO), hiển thị thông báo thành công
          if (transId && !error) {
            toast.success("Thanh toán MOMO thành công!");
          }
        } catch (error) {
          console.error("getOrderDetail error:", error);
          toast.error("Không thể tải thông tin đơn hàng.");
          // Nếu không tìm thấy order, redirect về checkout
          navigate("/checkout", { replace: true });
        } finally {
          setLoading(false);
        }
      };
      loadOrder();
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

  // Kiểm tra trạng thái đơn hàng
  const isCancelled = order?.status === "cancelled";
  const isAwaitingPayment = order?.status === "awaiting_payment";
  const hasError = error || isCancelled;

  return (
    <div className="order-success-main">
      <div className="order-success-container">

        {/* Success Icon and Title */}
        <div className="order-success-header">
          {hasError ? (
            <>
              <div className="order-success-icon" style={{ background: "linear-gradient(135deg, #dc3545 0%, #c82333 100%)", boxShadow: "0 4px 15px rgba(220, 53, 69, 0.3)" }}>
                <i className="fa fa-times"></i>
              </div>
              <h1 className="order-success-title" style={{ color: "#dc3545" }}>
                {isCancelled ? "Đơn hàng đã bị hủy!" : "Thanh toán thất bại!"}
              </h1>
              <p className="order-success-message">
                {isCancelled 
                  ? "Đơn hàng của bạn đã bị hủy do thanh toán không thành công." 
                  : decodeURIComponent(error || "Có lỗi xảy ra trong quá trình thanh toán.")
                }
              </p>
            </>
          ) : isAwaitingPayment ? (
            <>
              <div className="order-success-icon" style={{ background: "linear-gradient(135deg, #ffc107 0%, #ff9800 100%)", boxShadow: "0 4px 15px rgba(255, 193, 7, 0.3)" }}>
                <i className="fa fa-clock"></i>
              </div>
              <h1 className="order-success-title" style={{ color: "#ff9800" }}>Đang chờ thanh toán</h1>
              <p className="order-success-message">
                Vui lòng hoàn tất thanh toán để xác nhận đơn hàng.
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

        {/* Order Code */}

        {/* Action Buttons */}
        <div className="order-success-actions">
          {hasError ? (
            <>
              <Link
                to="/checkout"
                className="order-success-btn order-success-btn-primary"
              >
                <i className="fa fa-shopping-cart"></i>
                Quay lại giỏ hàng
              </Link>
              <Link
                to="/home"
                className="order-success-btn order-success-btn-secondary"
              >
                <i className="fa fa-home"></i>
                Về trang chủ
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/home"
                className="order-success-btn order-success-btn-secondary"
              >
                <i className="fa fa-home"></i>
                Về trang chủ
              </Link>
            </>
          )}
        </div>

        {/* COD Notice */}
      </div>
    </div>
  );
};

export default OrderSuccess;
