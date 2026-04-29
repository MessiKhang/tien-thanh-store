import React, { useEffect, useState, useRef } from "react";
import "../user/css/style.css";
import "../user/css/product-list.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import ProductCard from "../../components/ProductCard";
import axios from "axios";
import BannerSlider from "../../components/BannerSlider";

interface Product {
    _id: string;
    name: string;
    image: string;
    price: number | string | { $numberDecimal?: string };
    oldPrice?: number | string | { $numberDecimal?: string };
    salePercent?: number;
    tag?: string | null;
}

const Home: React.FC = () => {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [newestProducts, setNewestProducts] = useState<Product[]>([]);
    const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const saleSliderRef = useRef<HTMLDivElement>(null);
    const newestSliderRef = useRef<HTMLDivElement>(null);
    const featuredSliderRef = useRef<HTMLDivElement>(null);

    // // ❗ FIX LỖI: useRef phải đặt ngoài useEffect
    // const remainingTimeRef = useRef(24 * 60 * 60); // 24 giờ tính bằng giây

    // ⚡ FIX HÀM CHUẨN HÓA Decimal128 → number
    const toNumber = (value: number | string | { $numberDecimal?: string } | undefined): number => {
        if (!value) return 0;
        if (typeof value === "number") return value;
        if (typeof value === "string") return parseFloat(value) || 0;
        if (typeof value === "object" && "$numberDecimal" in value) {
            return parseFloat(value.$numberDecimal || "0") || 0;
        }
        return 0;
    };

    const formatPrice = (
        price: number | string | { $numberDecimal?: string } | undefined
    ): string =>
        toNumber(price).toLocaleString("vi-VN") + "₫";
    
    // Tính % sale chính xác
    const calculateSalePercent = (product: Product): number => {
        const price = toNumber(product.price);
        const oldPrice = toNumber(product.oldPrice);
        
        if (oldPrice > price && oldPrice > 0) {
            return Math.round(((oldPrice - price) / oldPrice) * 100);
        }
        
        return product.salePercent || 0;
    };

    // ===== LOAD PRODUCTS =====
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                // Lấy sản phẩm khuyến mãi (có tag "sale")
                const saleRes = await axios.get("http://localhost:5000/api/products?tag=sale");
                setAllProducts(saleRes.data);

                // Sản phẩm mới (có tag "new")
                const newestRes = await axios.get("http://localhost:5000/api/products?tag=new");
                const newest = newestRes.data.slice(0, 5);
                setNewestProducts(newest);

                // Sản phẩm nổi bật (có tag "featured")
                const featuredRes = await axios.get("http://localhost:5000/api/products?tag=featured");
                const featured = featuredRes.data.slice(0, 5);
                setFeaturedProducts(featured);
            } catch (err) {
                console.error(err);
                setError("Không thể tải sản phẩm từ server.");
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);


    const handleSlide = (
        slider: React.RefObject<HTMLDivElement | null>,
        direction: "next" | "prev"
    ) => {
        if (!slider.current) return;
        const card = slider.current.querySelector(".product-card--slider") as HTMLElement | null;
        let distance = slider.current.clientWidth || 250;

        if (card) {
            const styles = window.getComputedStyle(card);
            const marginRight = parseFloat(styles.marginRight || "0");
            distance = card.offsetWidth + marginRight;
        }

        const offset = direction === "next" ? distance : -distance;
        slider.current.scrollBy({ left: offset, behavior: "smooth" });
    };

    // ===== SLIDER + COUNTDOWN =====
    // useEffect(() => {
    //     // Countdown
    //     const timer = setInterval(() => {
    //         const hours = Math.floor(remainingTimeRef.current / 3600);
    //         const minutes = Math.floor((remainingTimeRef.current % 3600) / 60);
    //         const seconds = remainingTimeRef.current % 60;

    //         setCountdown(
    //             `${hours.toString().padStart(2, "0")} : ${minutes
    //                 .toString()
    //                 .padStart(2, "0")} : ${seconds
    //                     .toString()
    //                     .padStart(2, "0")}`
    //         );

    //         if (remainingTimeRef.current > 0) remainingTimeRef.current--;
    //     }, 1000);

    //     return () => clearInterval(timer);
    // }, []);

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "80px" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
                Đang tải dữ liệu...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: "center", padding: "80px", color: "#d90019" }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />
                {error}
            </div>
        );
    }

    return (
        <>
            {/* ===== BANNER SLIDER ===== */}
            <BannerSlider />

            {/* ===== SLIDER KHUYẾN MÃI HOT ===== */}
            <section className="promotion-slider">
                <div className="slider-header">
                    <span>KHUYẾN MÃI HOT 🔥</span>
                    {/* <span className="timer">{countdown}</span> */}
                </div>
                <div className="slider-container">
                    <button
                        className="slide-btn prev"
                        onClick={() => handleSlide(saleSliderRef, "prev")}
                    >
                        ‹
                    </button>

                    <div className="slider-list" ref={saleSliderRef}>
                        {allProducts
    .filter((p) => {
        const salePercent = calculateSalePercent(p);
        return salePercent > 0;
    })
    .sort((a, b) => calculateSalePercent(b) - calculateSalePercent(a))
    .slice(0, 12)
                            .map((product) => (
                                <ProductCard
                                    key={product._id}
                                    product={product}
                                    toNumber={toNumber}
                                    formatPrice={formatPrice}
                                    calculateSalePercent={calculateSalePercent}
                                    className="product-card--slider"
                                />
                            ))}
                    </div>

                    <button
                        className="slide-btn next"
                        onClick={() => handleSlide(saleSliderRef, "next")}
                    >
                        ›
                    </button>
                </div>
            </section>

            {/* ===== SẢN PHẨM MỚI NHẤT ===== */}
            <section className="promotion-slider">
                <div className="slider-header">
                    <span>SẢN PHẨM MỚI NHẤT</span>
                </div>
                <div className="slider-container">
                    <button
                        className="slide-btn prev"
                        onClick={() => handleSlide(newestSliderRef, "prev")}
                    >
                        ‹
                    </button>

                    <div className="slider-list" ref={newestSliderRef}>
                        {newestProducts.slice(0, 12).map((product) => (
                            <ProductCard
                                key={product._id}
                                product={product}
                                toNumber={toNumber}
                                formatPrice={formatPrice}
                                calculateSalePercent={calculateSalePercent}
                                className="product-card--slider"
                            />
                        ))}
                    </div>

                    <button
                        className="slide-btn next"
                        onClick={() => handleSlide(newestSliderRef, "next")}
                    >
                        ›
                    </button>
                </div>
            </section>

            {/* ===== SẢN PHẨM NỔI BẬT ===== */}
            <section className="promotion-slider">
                <div className="slider-header">
                    <span>GỢI Ý CHO BẠN</span>
                </div>
                <div className="slider-container">
                    <button
                        className="slide-btn prev"
                        onClick={() => handleSlide(featuredSliderRef, "prev")}
                    >
                        ‹
                    </button>

                    <div className="slider-list" ref={featuredSliderRef}>
                        {featuredProducts.slice(0, 12).map((product) => (
                            <ProductCard
                                key={product._id}
                                product={product}
                                toNumber={toNumber}
                                formatPrice={formatPrice}
                                calculateSalePercent={calculateSalePercent}
                                className="product-card--slider"
                            />
                        ))}
                    </div>

                    <button
                        className="slide-btn next"
                        onClick={() => handleSlide(featuredSliderRef, "next")}
                    >
                        ›
                    </button>
                </div>
            </section>

            <br />
        </>
    );
};

export default Home;
