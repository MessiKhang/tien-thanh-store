import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/cart.css";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import {
    getStoredCartItems,
    removeStoredCartItem,
    updateStoredCartQuantity,
} from "../../services/cartStorage";

type CartProduct = {
    _id: string;
    name: string;
    image?: string;
    price?: number | string | { $numberDecimal?: string };
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

const Cart: React.FC = () => {
    const [cart, setCart] = useState<CartResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [usingLocalCart, setUsingLocalCart] = useState(false);

    const navigate = useNavigate();
    const { user, loading: authLoading, refreshCartCount } = useAuth();

    const buildLocalCart = useCallback((): CartResponse => {
        const storedItems = getStoredCartItems();
        return {
            items: storedItems.map((item) => ({
                productId: {
                    _id: item.productId,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    oldPrice: item.oldPrice,
                },
                quantity: item.quantity,
                selectedColor: item.selectedColor || "",
            })),
        };
    }, []);

    const toNumber = (value?: number | string | { $numberDecimal?: string }) => {
        if (typeof value === "number") return value;
        if (typeof value === "string") return parseFloat(value) || 0;
        if (value && typeof value === "object" && "$numberDecimal" in value) {
            return parseFloat(value.$numberDecimal || "0") || 0;
        }
        return 0;
    };

    const fetchCart = useCallback(async () => {
        if (!user?.id) {
            setCart(buildLocalCart());
            setUsingLocalCart(true);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await axios.get(`http://localhost:5000/api/cart/${user.id}`);
            setCart(res.data);
            setUsingLocalCart(false);
        } catch (err) {
            console.error("Lỗi lấy giỏ hàng:", err);
            toast.error("Không thể tải giỏ hàng. Vui lòng thử lại.");
            setCart(buildLocalCart());
            setUsingLocalCart(true);
        } finally {
            setLoading(false);
            await refreshCartCount(user?.id);
        }
    }, [user?.id, buildLocalCart]);

    const updateQty = async (productId: string, selectedColor: string | undefined, qty: number) => {
        if (qty < 1) return;
        if (!user?.id) {
            updateStoredCartQuantity(productId, selectedColor || "", qty);
            setCart(buildLocalCart());
            await refreshCartCount(undefined); // ← còn thiếu
            return;
        }
        try {
            const uniqueKey = `${productId}_${selectedColor || ""}`;
            setUpdatingId(uniqueKey);
            await axios.post("http://localhost:5000/api/cart/update", {
                userId: user.id,
                productId,
                selectedColor: selectedColor || "",
                quantity: qty,
            });
            // Cập nhật local state thay vì fetch lại - tìm đúng item có cùng productId và selectedColor
            setCart((prev) => {
    if (!prev?.items) return prev;

    return {
        items: prev.items.map((item) =>
            item.productId._id === productId &&
            (item.selectedColor || "") === (selectedColor || "")
                ? { ...item, quantity: qty }
                : item
        ),
    };
});

            await refreshCartCount(user?.id); // ← Cập nhật badge

        } catch (err) {
            console.error("Lỗi cập nhật số lượng:", err);
            toast.error("Không thể cập nhật số lượng.");
            // Rollback bằng cách fetch lại
            fetchCart();
        } finally {
            setUpdatingId(null);
        }
    };

    const removeItem = async (productId: string, selectedColor: string | undefined) => {
        try {
            const uniqueKey = `${productId}_${selectedColor || ""}`;
            setUpdatingId(uniqueKey);
            if (!user?.id) {
                removeStoredCartItem(productId, selectedColor || "");
                setCart(buildLocalCart());
                await refreshCartCount(undefined); // ← cập nhật badge guest
                toast.success("Đã xoá sản phẩm khỏi giỏ hàng.");
                return;
            }

            await axios.post("http://localhost:5000/api/cart/remove", {
                userId: user.id,
                productId,
                selectedColor: selectedColor || "",
            });
            // Cập nhật local state thay vì fetch lại - xóa đúng item có cùng productId và selectedColor
            setCart((prev) => {
                if (!prev?.items) return prev;
                return {
                    items: prev.items.filter(
                    (item) =>
                !(item.productId._id === productId &&
                (item.selectedColor || "") === (selectedColor || ""))
                    ),
                };
            });

            await refreshCartCount(user?.id); // ← cập nhật badge

        toast.success("Đã xoá sản phẩm khỏi giỏ hàng.");
        } catch (err) {
            console.error("Lỗi xóa sản phẩm:", err);
            toast.error("Không thể xóa sản phẩm.");
            // Rollback bằng cách fetch lại
            fetchCart();
        } finally {
            setUpdatingId(null);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        fetchCart();
    }, [authLoading, fetchCart]);

    // Tổng tiền gốc (để tính tiết kiệm)
    const originalTotal = useMemo(() => {
        if (!cart?.items?.length) return 0;
        return cart.items.reduce((sum: number, item: CartItem) => {
            const price = toNumber(item.productId.price);
            const oldPrice = toNumber(item.productId.oldPrice);
            const hasSale = oldPrice > price && oldPrice > 0;
            // Tổng tiền gốc = giá gốc * số lượng
            return sum + (hasSale ? oldPrice : price) * item.quantity;
        }, 0);
    }, [cart]);

    // Tạm tính (tính theo giá giảm - giá sau khi sale)
    const subTotal = useMemo(() => {
        if (!cart?.items?.length) return 0;
        return cart.items.reduce(
            (sum: number, item: CartItem) =>
                sum + toNumber(item.productId.price) * item.quantity,
            0
        );
    }, [cart]);

    // Tiết kiệm = tổng tiền gốc - tổng tiền giảm
    const savings = originalTotal - subTotal;

    if (loading || authLoading) {
        return <h2>Đang tải giỏ hàng...</h2>;
    }

    const isEmpty = !cart?.items || cart.items.length === 0;

    const handleCheckout = () => {
        if (usingLocalCart) {
            toast.info("Vui lòng đăng nhập để tiếp tục thanh toán.");
            navigate("/login", { state: { redirect: "/cart" } });
            return;
        }
        navigate("/checkout");
    };

    return (
        <div className="cart-main">
            <div className="breadcrumb">
                <Link to="/home">Trang chủ</Link> &gt; <span>Giỏ hàng</span>
            </div>

            <h1 className="cart-title">
                Giỏ hàng của bạn
                <span className="cart-title-small">({cart?.items?.length || 0} sản phẩm)</span>
            </h1>

            <div className="cart-table">
                <div className="cart-table-header">
                    <div>Sản phẩm</div>
                    <div>Giá</div>
                    <div>Số lượng</div>
                    <div>Thành tiền</div>
                </div>

                {!isEmpty &&
                    cart?.items?.map((item: CartItem, index: number) => {
                        const product = item.productId;
                        const price = toNumber(product.price);
                        const oldPrice = toNumber(product.oldPrice);
                        const hasSale = oldPrice > price && oldPrice > 0;
                        const itemTotal = price * item.quantity;
                        const itemOldTotal = hasSale ? oldPrice * item.quantity : itemTotal;
                        // Tạo unique key bằng productId + selectedColor + index để tránh duplicate
                        const uniqueKey = `${product._id}_${item.selectedColor || ""}_${index}`;
                        return (
                            <div key={uniqueKey} className="cart-table-row">
                                <div className="cart-product">
                                    <img src={product.image} alt={product.name} />
                                    <div>
                                        <div className="cart-product-name">{product.name}</div>
                                        {item.selectedColor && (
                                            <div className="cart-product-color" style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                                                Màu: {item.selectedColor}
                                            </div>
                                        )}  
                                        <div
                                            className="cart-product-remove"
                                            onClick={() => removeItem(product._id, item.selectedColor)}
                                        >
                                            <i className="fa fa-trash"></i> Xóa sản phẩm
                                        </div>
                                    </div>
                                </div>

                                <div className="cart-price">
                                    {hasSale ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <span style={{ color: "#d90019", fontWeight: 600 }}>
                                                {price.toLocaleString()}đ
                                            </span>
                                            <span style={{ color: "#999", textDecoration: "line-through", fontSize: "13px" }}>
                                                {oldPrice.toLocaleString()}đ
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{ color: "#d90019", fontWeight: 600 }}>
                                            {price.toLocaleString()}đ
                                        </span>
                                    )}
                                </div>

                                <div className="cart-qty">
                                    <button
                                        className="qty-btn"
                                        onClick={() => updateQty(product._id, item.selectedColor, item.quantity - 1)}
                                        disabled={updatingId === `${product._id}_${item.selectedColor || ""}`}
                                    >
                                        -
                                    </button>

                                    <input
                                        className="cart-qty-input"
                                        value={item.quantity}
                                        readOnly
                                    />

                                    <button
                                        className="qty-btn"
                                        onClick={() => updateQty(product._id, item.selectedColor, item.quantity + 1)}
                                        disabled={updatingId === `${product._id}_${item.selectedColor || ""}`}
                                    >
                                        +
                                    </button>
                                </div>

                                <div className="cart-price">
                                    <span style={{ color: "#d90019", fontWeight: 600 }}>
                                        {itemTotal.toLocaleString()}đ
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                {isEmpty && (
                    <div className="cart-empty">
                        <p>Giỏ hàng của bạn đang trống.</p>
                        <Link to="/home" className="btn btn-primary">
                            Tiếp tục mua sắm
                        </Link>
                    </div>
                )}
            </div>

            {/* Tổng tiền */}
            <div className="cart-summary">
                <div className="cart-summary-inner">
                    <div>
                        <div className="cart-summary-label">Tạm tính:</div>
                        <div className="cart-summary-value">{subTotal.toLocaleString()}đ</div>
                    </div>
                    {savings > 0 && (
                        <div style={{ color: "#28a745" }}>
                            <div className="cart-summary-label">Tiết kiệm:</div>
                            <div className="cart-summary-value" style={{ color: "#28a745", fontWeight: 600 }}>
                                -{savings.toLocaleString()}đ
                            </div>
                        </div>
                    )}
                </div>

                <button
                    className="btn-checkout"
                    disabled={isEmpty}
                    onClick={handleCheckout}
                >
                    {isEmpty ? "Giỏ hàng trống" : "Tiến hành thanh toán"}
                </button>
            </div>
        </div>
    );
};

export default Cart;
