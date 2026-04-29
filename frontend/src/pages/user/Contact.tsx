import React from "react";
import { Link } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/contact.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const Contact: React.FC = () => {
    return (
        <div className="contact-main">
            <div className="breadcrumb">
                <Link to="/">Trang chủ</Link> &gt; <span>Liên hệ</span>
            </div>

            <div className="contact-header">
                <h1>Liên hệ với chúng tôi</h1>
                <p>
                    Tiến Thành Store luôn sẵn sàng lắng nghe và giải đáp mọi thắc mắc của
                    bạn. Hãy liên hệ để được hỗ trợ nhanh nhất!
                </p>
            </div>

            <div className="contact-content">
                {/* FORM */}
                <div className="contact-form-wrap">
                    <div className="contact-title">Gửi thông tin liên hệ</div>
                    <form className="contact-form">
                        <input type="text" placeholder="Họ và tên" required />
                        <input type="email" placeholder="Email" required />
                        <input type="text" placeholder="Số điện thoại" />
                        <textarea rows={4} placeholder="Nội dung liên hệ" required></textarea>
                        <button type="submit" className="contact-btn-send">
                            <i className="fa fa-paper-plane"></i> Gửi liên hệ
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Contact;
