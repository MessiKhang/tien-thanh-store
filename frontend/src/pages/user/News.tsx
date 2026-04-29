import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../user/css/style.css";
import "../user/css/new.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { getAllNews, type News } from "../../services/newsService";

const PLACEHOLDER_IMG = "https://via.placeholder.com/460x460/fff3f4/ee4d2d?text=No+Image";

const normalizeImageUrl = (src?: string) => {
    if (!src) return PLACEHOLDER_IMG;
    if (/^https?:\/\//i.test(src)) return src;
    const cleanPath = src.replace(/^\/+/, "").replace(/\\/g, "/");
    return `http://localhost:5000/${cleanPath}`;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const New: React.FC = () => {
    const [allNews, setAllNews] = useState<News[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                setLoading(true);
                // Lấy tất cả tin tức đang hoạt động
                const activeNews = await getAllNews({ isActive: true });
                setAllNews(activeNews);

            } catch (error) {
                console.error("Lỗi khi lấy tin tức:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    if (loading) {
        return (
            <div className="news-main">
                <div className="news-breadcrumb">
                    <Link to="/home">Trang chủ</Link> &gt; <span>Tin tức</span>
                </div>
                <div style={{ textAlign: "center", padding: "40px" }}>
                    <p>Đang tải tin tức...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="news-main">
            <div className="news-breadcrumb">
                <Link to="/home">Trang chủ</Link> &gt; <span>Tin tức</span>
            </div>

            <div className="news-layout">
                {/* Cột 1: Tin tức chính */}
                <div className="news-col news-col-main">
                    <h1 className="news-section-title">Tin tức</h1>
                    {allNews.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px" }}>
                            <p>Chưa có tin tức nào.</p>
                        </div>
                    ) : (
                        <div className="news-list">
                            {allNews.map((newsItem) => (
                                <div key={newsItem._id} className="news-main-card">
                                    <Link to={`/news/${newsItem._id}`} className="news-main-img">
                                        <img
                                            src={normalizeImageUrl(newsItem.image)}
                                            alt={newsItem.title}
                                            onError={(e) => {
                                                e.currentTarget.src = PLACEHOLDER_IMG;
                                            }}
                                        />
                                    </Link>
                                    <div className="news-main-info">
                                        <Link to={`/news/${newsItem._id}`} className="news-main-title">
                                            {newsItem.title}
                                        </Link>
                                        <div className="news-main-meta">
                                            <span>Đăng bởi <b>{newsItem.author || "Admin"}</b></span> &nbsp; | &nbsp;
                                            <span>{formatDate(newsItem.createdAt)}</span>
                                        </div>
                                        {newsItem.summary && (
                                            <div className="news-main-desc">
                                                {newsItem.summary}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default New;
