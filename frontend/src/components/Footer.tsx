import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/img/logo.png";
import momo from "../assets/img/momo.jpg";
import "./style.css";
import "./product-list.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const Footer: React.FC = () => {
    return (
        <>
            {/* <section className="newsletter">
                <div className="newsletter-inner">
                    <label htmlFor="newsletter-email">ĐĂNG KÍ NHẬN TIN KHUYẾN MÃI</label>
                    <div className="newsletter-form">
                        <input
                            type="email"
                            id="newsletter-email"
                            placeholder="Nhập email của bạn..."
                        />
                        <Link to="/register" className="newsletter-btn">
                            Đăng ký
                        </Link>
                    </div>
                </div>
            </section> */}
            <footer className="main-footer">
                <div className="footer-top">
                    <div className="footer-logo">
                        <img src={logo} alt="Tiến Thành Store" className="footer-logo-img" />
                        <div className="footer-contact">
                            <p><strong>Tiến Thành Store</strong></p>
                            <p>
                                <i className="fa fa-map-marker-alt"></i>{" "}
                                1081-1083 Trần Hưng Đạo, Phường An Đông, TP.HCM
                            </p>
                            <p>
                                <i className="fa fa-phone"></i> 19005360
                            </p>
                            <p>
                                <i className="fa fa-envelope"></i> cskh@maytinhbienhoa.vn
                            </p>
                        </div>
                    </div>

                    <div className="footer-links">
                        <div>
                            <div className="footer-title">HỖ TRỢ KHÁCH HÀNG</div>
                            <ul>
                                <li><Link to="/guide">Hướng dẫn mua hàng</Link></li>
                                <li><Link to="/shipping">Chính sách giao hàng</Link></li>
                                <li><Link to="/return-policy">Chính sách đổi trả</Link></li>
                                <li><Link to="/privacy">Chính sách bảo mật</Link></li>
                                <li><Link to="/payment-policy">Chính sách thanh toán</Link></li>
                            </ul>
                        </div>

                        <div>
                            <div className="footer-title">KẾT NỐI VỚI CHÚNG TÔI</div>
                            <div className="footer-socials">
                                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-facebook-f"></i></a>
                                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-youtube"></i></a>
                                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-tiktok"></i></a>
                                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-instagram"></i></a>
                                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"><i className="fab fa-twitter"></i></a>
                            </div>

                            <div className="footer-title mt-3">PHƯƠNG THỨC THANH TOÁN</div>
                            <img src={momo} alt="Thanh toán Momo" className="payment-icons" />
                        </div>
                    </div>
                </div>

            </footer>
        </>
    );
};

export default Footer;
