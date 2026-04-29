import React, { useState, useEffect, useRef } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./css/admin-layout.css";

const AdminLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [productMenuOpen, setProductMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Đóng dropdown khi click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleLogout = () => {
        logout();
        toast.success("Đăng xuất thành công!");
        navigate("/login");
    };

    return (
        <div className="admin-container">

            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="logo"></div>

                <nav>
                    <Link className="menu-link" to="/admin/dashboard">
                        <i className="fa-solid fa-house"></i> Tổng quan
                    </Link>


                    <Link className="menu-link" to="/admin/orders">
                        <i className="fa-solid fa-box"></i> Đơn hàng
                    </Link>

                    <Link className="menu-link" to="/admin/coupons">
                        <i className="fa-solid fa-ticket"></i> Mã giảm giá
                    </Link>

                    {/* Sản phẩm + submenu */}
                    <div
                        className="menu-link submenu-toggle"
                        onClick={() => setProductMenuOpen(!productMenuOpen)}
                    >
                        <i className="fa-solid fa-pen-nib"></i> Sản phẩm
                        <i className="fa-solid fa-angle-down" style={{ marginLeft: "auto" }}></i>
                    </div>

                    {productMenuOpen && (
                        <div className="submenu">
                            <Link className="submenu-link" to="/admin/products">
                                Danh sách sản phẩm
                            </Link>
                            <Link className="submenu-link" to="/admin/categories">
                                Danh mục sản phẩm
                            </Link>
                            <Link className="submenu-link" to="/admin/brands">
                                Thương hiệu
                            </Link>
                        </div>
                    )}

                    <Link className="menu-link" to="/admin/customers">
                        <i className="fa-solid fa-user-group"></i> Khách hàng
                    </Link>

                    {/* <Link className="menu-link" to="/admin/news">
                        <i className="fa-solid fa-newspaper"></i> Tin tức
                    </Link>
                    <Link className="menu-link" to="/admin/banners">
                        <i className="fa-solid fa-image"></i> Banner
                    </Link> */}
                    <Link className="menu-link" to="/admin/reviews">
                        <i className="fa-solid fa-star"></i> Bình luận
                    </Link>
                </nav>
            </aside>

            {/* MAIN WRAPPER */}
            <div className="admin-main">

                {/* HEADER */}
                <header className="admin-header" style={{ justifyContent: "flex-end" }}>
                    <div className="header-actions">
                        <div
                            ref={dropdownRef}
                            className={`admin-dropdown ${dropdownOpen ? "active" : ""}`}
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <i className="fa-regular fa-user-circle"></i>
                            <span className="admin-name">{user?.name || "Admin"}</span>
                            <i className="fa-solid fa-angle-down"></i>

                            {dropdownOpen && (
                                <div className="user-dropdown">
                                    <div className="user-info">
                                        <i className="fa-regular fa-user-circle"></i>
                                        <div>
                                            <div className="name">{user?.name || "Admin"}</div>
                                            <div className="email">{user?.email || "admin@email.com"}</div>
                                        </div>
                                    </div>

                                    <div className="dropdown-links">
                                        <button 
                                            onClick={handleLogout}
                                            style={{ 
                                                background: "none", 
                                                border: "none", 
                                                width: "100%", 
                                                textAlign: "left",
                                                cursor: "pointer",
                                                padding: "10px 15px",
                                                color: "#333"
                                            }}
                                        >
                                            <i className="fa-solid fa-right-from-bracket"></i> Đăng xuất
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <main className="admin-content">
                    <Outlet />
                </main>

            </div>
        </div>
    );
};

export default AdminLayout;
