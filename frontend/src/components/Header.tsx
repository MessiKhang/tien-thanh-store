import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/img/logo.png";
import "./style.css";
import "./product-list.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const Header: React.FC = () => {
    const [text, setText] = useState("");
    const [showUserMenu, setShowUserMenu] = useState(false);
    const navigate = useNavigate();
    const { user, isAuth, logout, cartCount } = useAuth();
    const menuRef = useRef<HTMLDivElement>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() == "") return;
        navigate(`/products?search=${encodeURIComponent(text)}`);
    };

    const handleLogout = () => {
        logout();
        toast.success("Đăng xuất thành công!");
        navigate("/home");
        setShowUserMenu(false);
    };

    // Đóng menu khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showUserMenu]);

    return (
        <header className="main-header">
            <div className="header-main">
                <div className="logo">
                    <Link to="/home">
                        <img src={logo} alt="Logo Máy Tính Biên Hòa" />
                    </Link>
                </div>

                <form className="search-bar" onSubmit={handleSearch}>
                    <input
                        type="text"
                        placeholder="Tìm kiếm sản phẩm..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <button type="submit">
                        <i className="fa fa-search"></i>
                    </button>
                </form>

                <div className="header-icons">
                    {isAuth && user ? (
                        <div className="user-menu-container" ref={menuRef} style={{ position: "relative" }}>
                            <button
                                className="user-menu-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    color: "#333",
                                    fontSize: "14px",
                                }}
                            >
                                <i className="fa-regular fa-user"></i>
                                <span>{user.name}</span>
                                <i className={`fa fa-chevron-${showUserMenu ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
                            </button>
                            {showUserMenu && (
                                <div
                                    className="user-dropdown"
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        right: 0,
                                        background: "#fff",
                                        border: "1px solid #ddd",
                                        borderRadius: "8px",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                        minWidth: "200px",
                                        marginTop: "8px",
                                        zIndex: 1000,
                                    }}
                                >
                                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee" }}>
                                        <div style={{ fontWeight: "600", marginBottom: "4px" }}>{user.name}</div>
                                        <div style={{ fontSize: "13px", color: "#666" }}>{user.email}</div>
                                    </div>
                                    <div className="order-links">
                                        <Link to="/orders">
                                            <i className="fa-regular fa-clipboard"></i> Đơn hàng của tôi
                                        </Link>
                                    </div>
                                    <Link
                                        to="/profile"
                                        style={{
                                            display: "block",
                                            padding: "10px 16px",
                                            textDecoration: "none",
                                            color: "#333",
                                            borderBottom: "1px solid #eee",
                                        }}
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <i className="fa fa-user" style={{ marginRight: "8px" }}></i>
                                        Thông tin tài khoản
                                    </Link>
                                    <Link
                                        to="/orders"
                                        style={{
                                            display: "block",
                                            padding: "10px 16px",
                                            textDecoration: "none",
                                            color: "#333",
                                            borderBottom: "1px solid #eee",
                                        }}
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <i className="fa fa-shopping-bag" style={{ marginRight: "8px" }}></i>
                                        Đơn hàng
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            width: "100%",
                                            padding: "10px 16px",
                                            background: "none",
                                            border: "none",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            color: "#d90019",
                                            fontWeight: "500",
                                        }}
                                    >
                                        <i className="fa fa-sign-out" style={{ marginRight: "8px" }}></i>
                                        Đăng xuất
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" title="Tài khoản">
                            <i className="fa-regular fa-user"></i>
                        </Link>
                    )}
                    {/* <Link to="/cart" title="Giỏ hàng">
                        <i className="fa-solid fa-cart-shopping"></i>
                    </Link> */}
                    <Link to="/cart" title="Giỏ hàng" style={{ position: "relative" }}>
    <i className="fa-solid fa-cart-shopping"></i>

    {cartCount > 0 && (
        <span
            style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#d90019",
                color: "#fff",
                borderRadius: "50%",
                width: "18px",
                height: "18px",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                lineHeight: 1,
            }}
        >
            {cartCount > 99 ? "99+" : cartCount}
        </span>
    )}
</Link>
                </div>
            </div>
        </header>
    );
};

export default Header;
