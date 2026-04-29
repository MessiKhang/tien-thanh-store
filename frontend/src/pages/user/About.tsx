import React from "react";
import { Link } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/contact.css";

const About: React.FC = () => {
    return (
        <div className="contact-main">
            <div className="breadcrumb">
                <Link to="/">Trang chủ</Link> &gt; <span>Giới thiệu</span>
            </div>

            <div className="contact-header">
                <h1>Về Tiến Thành Store</h1>
                <p>
                    Chào mừng bạn đến với <b>Tiến Thành Store</b> – địa chỉ tin cậy chuyên cung cấp
                    các sản phẩm công nghệ, máy tính và linh kiện chính hãng với giá tốt nhất.
                </p>
            </div>

            <div className="contact-content">
                {/* GIỚI THIỆU CÔNG TY */}
                <div className="contact-form-wrap">
                    <div className="contact-title">Giới thiệu cửa hàng</div>
                    <div className="contact-description">
                        <p>
                            Được thành lập từ năm <b>2015</b>, <b>Tiến Thành Store</b> đã và đang không
                            ngừng phát triển để trở thành một trong những đơn vị cung cấp thiết bị máy
                            tính uy tín hàng đầu tại Việt Nam. Chúng tôi chuyên kinh doanh:
                        </p>
                        <ul style={{ listStyle: "disc", paddingLeft: "20px", marginTop: "12px", marginBottom: "16px" }}>
                            <li style={{ marginBottom: "8px" }}>Laptop, PC, linh kiện và phụ kiện chính hãng</li>
                            <li style={{ marginBottom: "8px" }}>Các giải pháp công nghệ dành cho doanh nghiệp</li>
                            <li style={{ marginBottom: "8px" }}>Dịch vụ bảo hành, sửa chữa và hỗ trợ kỹ thuật tận tâm</li>
                        </ul>
                        <p>
                            Với phương châm <b>“Uy tín – Chất lượng – Tận tâm”</b>, Tiến Thành Store luôn
                            đặt trải nghiệm khách hàng lên hàng đầu. Đội ngũ kỹ thuật viên chuyên nghiệp
                            và nhân viên tư vấn giàu kinh nghiệm luôn sẵn sàng hỗ trợ bạn trong mọi tình huống.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
