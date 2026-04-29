import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBanners, type Banner } from "../services/bannerService";
import "../components/style.css";

const normalizeImageUrl = (src?: string) => {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const cleanPath = src.replace(/^\/+/, "").replace(/\\/g, "/");
  return `http://localhost:5000/${cleanPath}`;
};

const BannerSlider: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const data = await getBanners(true); // Chỉ lấy banners đang active
        setBanners(data);
        if (data.length > 0) {
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error("Lỗi lấy banners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Tự động chuyển slide
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Chuyển slide mỗi 5 giây

    return () => clearInterval(interval);
  }, [banners.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (loading) {
    return null; // Hoặc có thể hiển thị skeleton
  }

  if (banners.length === 0) {
    return null; // Không hiển thị gì nếu không có banner
  }

  const currentBanner = banners[currentIndex];

  return (
    <section className="main-banner">
      <div className="banner-content">
        <div className="banner-text">
          {currentBanner.subtitle && (
            <span className="sub">{currentBanner.subtitle}</span>
          )}
          {currentBanner.discountText && (
            <span className="discount" dangerouslySetInnerHTML={{ __html: currentBanner.discountText }}></span>
          )}
          <Link to={currentBanner.link || "#"} className="btn-banner">
            Mua ngay
          </Link>
        </div>
        <img
          className="banner-products"
          src={normalizeImageUrl(currentBanner.image)}
          alt={currentBanner.title}
        />
      </div>

      {/* Navigation dots
      {banners.length > 1 && (
        <div className="banner-dots">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`banner-dot ${index === currentIndex ? "active" : ""}`}
              onClick={() => goToSlide(index)}
              aria-label={`Chuyển đến slide ${index + 1}`}
            />
          ))}
        </div>
      )} */}

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button className="banner-arrow banner-arrow-prev" onClick={goToPrev} aria-label="Slide trước">
            ‹
          </button>
          <button className="banner-arrow banner-arrow-next" onClick={goToNext} aria-label="Slide sau">
            ›
          </button>
        </>
      )}
    </section>
  );
};

export default BannerSlider;

