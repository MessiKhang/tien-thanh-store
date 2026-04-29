import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../user/css/product-detail.css";
import "../user/css/product-list.css";
import "../user/css/style.css";
import ProductCard from "../../components/ProductCard";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { upsertStoredCartItem } from "../../services/cartStorage";
import {
  getReviewsByProduct,
  createReview,
  type Review,
  type ProductReviewsResponse,
} from "../../services/reviewService";

type Taxonomy = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
};

type Product = {
  _id: string;
  name: string;
  slug?: string;
  image?: string;
  images?: string[];
  price?: number | string | { $numberDecimal?: string };
  oldPrice?: number | string | { $numberDecimal?: string };
  desc?: string;
  brand?: string | Taxonomy;
  category?: string | Taxonomy;
  salePercent?: number;
  tag?: string | null;
  color?: string | string[];
  stock?: number;                                    // ← add
  colorStocks?: { name: string; stock: number }[];   // ← add
};

type ProductCardData = {
  _id: string;
  name: string;
  image: string;
  price: number | string | { $numberDecimal?: string };
  oldPrice?: number | string | { $numberDecimal?: string };
  salePercent?: number;
  tag?: string | null;
};

type TabKey = "desc" | "reviews";

const PLACEHOLDER_IMG = "https://via.placeholder.com/460x460/fff3f4/ee4d2d?text=No+Image";

const normalizeImageUrl = (src?: string) => {
  if (!src) return PLACEHOLDER_IMG;
  if (/^https?:\/\//i.test(src)) return src;
  const cleanPath = src.replace(/^\/+/, "").replace(/\\/g, "/");
  return `http://localhost:5000/${cleanPath}`;
};

const resolveEntityName = (value?: string | Taxonomy, fallback = "Đang cập nhật") => {
  if (!value) return fallback;
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "object") {
    return value.name || value.slug || value.id || value._id || fallback;
  }
  return fallback;
};

const formatCurrency = (value?: number | string | { $numberDecimal?: string }) => {
  if (value === null || value === undefined) return "Liên hệ";
  let amount = 0;
  if (typeof value === "number") {
    amount = value;
  } else if (typeof value === "string") {
    amount = parseFloat(value) || 0;
  } else if (typeof value === "object" && "$numberDecimal" in value) {
    amount = parseFloat(value.$numberDecimal || "0") || 0;
  }
  if (!amount) return "Liên hệ";
  return `${amount.toLocaleString("vi-VN")}₫`;
};
;

// Review samples đã được thay thế bằng reviews từ API

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>("desc");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const relatedSliderRef = useRef<HTMLDivElement | null>(null);
  const { user, isAuth, refreshCartCount } = useAuth();
  const userId = user?.id;

  // Review states
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }>({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
const [reviewForm, setReviewForm] = useState({
  comment: "",
});

  const toNumber = (value: Product["price"]) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || 0;
    if (typeof value === "object" && "$numberDecimal" in value) {
      return parseFloat(value.$numberDecimal || "0") || 0;
    }
    return 0;
  };

  const formatPrice = (value: Product["price"]) => `${toNumber(value).toLocaleString("vi-VN")}₫`;

  const calculateSalePercent = (item: Product): number => {
    const price = toNumber(item.price);
    const oldPrice = toNumber(item.oldPrice);
    if (oldPrice > price && oldPrice > 0) {
      return Math.round(((oldPrice - price) / oldPrice) * 100);
    }
    return item.salePercent || 0;
  };

  const toCardProduct = (item: Product): ProductCardData => ({
    _id: item._id,
    name: item.name,
    image: item.image || PLACEHOLDER_IMG,
    price: item.price ?? 0,
    oldPrice: item.oldPrice,
    salePercent: item.salePercent,
    tag: item.tag,
  });

  const handleAddToCart = async (item: Product) => {
    if (addingToCart || !item?._id) return;

    // ❗ Kiểm tra đăng nhập trước
    if (!isAuth || !userId) {
      toast.error("Vui lòng đăng nhập để thêm vào giỏ hàng");
      navigate("/login", { state: { redirect: `/product/${id}` } });
      return;
    }
      

        const colorStock = product?.colorStocks?.find(cs => cs.name === selectedColor);
        const maxStock = colorStock?.stock ?? product?.stock ?? Infinity;

        if (maxStock === 0) {
          toast.error("Sản phẩm này đã hết hàng.");
          return;
        }

        if (quantity > maxStock) {
          toast.error(`Chỉ còn ${maxStock} sản phẩm trong kho.`);
          setQuantity(maxStock);
          return;
        }
    try {
      setAddingToCart(true);

      const finalPrice = toNumber(item.price);
      const normalizedImage = normalizeImageUrl(item.image || item.images?.[0]);


      await axios.post("http://localhost:5000/api/cart/add", {
        userId,
        productId: item._id,
        name: item.name,
        image: normalizedImage,
        quantity,
        price: finalPrice,
        selectedColor: selectedColor,
      });

      toast.success(
  `Đã thêm "${item.name}" (${quantity} sản phẩm, màu: ${selectedColor}) vào giỏ hàng!`
);

await refreshCartCount(userId); // ← Cập nhật badge

} catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage =
        err.response?.data?.message ||
        "Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async (item: Product) => {
    if (buyingNow || !item?._id) return;

    // Kiểm tra đăng nhập trước
    if (!isAuth || !userId) {
      toast.error("Vui lòng đăng nhập để mua hàng");
      navigate("/login", { state: { redirect: `/product/${id}` } });
      return;
    }

    try {
      setBuyingNow(true);
      const finalPrice = toNumber(item.price);
      const normalizedImage = normalizeImageUrl(item.image || item.images?.[0]);

      // Lấy tên màu từ selectedColor
      

      // Thêm sản phẩm vào giỏ hàng
      await axios.post("http://localhost:5000/api/cart/add", {
        userId,
        productId: item._id,
        name: item.name,
        image: normalizedImage,
        quantity,
        price: finalPrice,
        selectedColor: selectedColor,
      });

      // Chuyển đến trang thanh toán
      await refreshCartCount(userId); // ← Cập nhật badge
      // Chuyển đến trang thanh toán
    navigate("/checkout");
    } catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || "Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setBuyingNow(false);
    }
  };

  const handleSlide = (slider: React.RefObject<HTMLDivElement | null>, direction: "next" | "prev") => {
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

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    try {
      setReviewLoading(true);
      const res: ProductReviewsResponse = await getReviewsByProduct(id);
      const reviewsData = res.data.reviews || [];
      const avgRating = parseFloat(res.data.averageRating || "0");
      const total = res.data.totalReviews || 0;

      // Tính phân bố rating
      const distribution: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviewsData.forEach((review) => {
        distribution[review.rating as keyof typeof distribution]++;
      });

      setReviews(reviewsData);
      setReviewStats({
        averageRating: avgRating,
        totalReviews: total,
        ratingDistribution: distribution,
      });
    } catch (error) {
      console.error("Lỗi lấy bình luận:", error);
    } finally {
      setReviewLoading(false);
    }
  }, [id]);

  const handleSubmitReview = async () => {
    if (!isAuth || !user?.id) {
      toast.error("Vui lòng đăng nhập để bình luận sản phẩm");
      return;
    }
    if (!id) return;
    if (!reviewForm.comment.trim()) {
    toast.error("Vui lòng nhập bình luận");
    return;
    }

    try {
      setSubmittingReview(true);
      await createReview({
    productId: id,
    rating: 5, // default rating
    comment: reviewForm.comment.trim(),
    });
      toast.success("Bình luận của bạn đã được gửi thành công!");
      setReviewForm({ comment: "" });
      await fetchReviews();
    } catch (error: unknown) {
      console.error("Lỗi gửi bình luận:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Không thể gửi bình luận. Vui lòng thử lại.");
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/products/${id}`);
        setProduct(res.data);
      } catch (error) {
        console.error("Lỗi lấy chi tiết sản phẩm:", error);
        setProduct(null);
      } finally {
        setLoading(false);
        setQuantity(1);
        setActiveTab("desc");
      }
    };

    if (id) {
      fetchProduct();
      fetchReviews();
    }
  }, [id, fetchReviews]);

  useEffect(() => {
    const fetchRelated = async () => {
      if (!product?.category) return;
      try {
        const categoryId = typeof product.category === 'object' ? product.category._id : product.category;
        const res = await axios.get(`http://localhost:5000/api/products?category=${categoryId}&limit=12`);
        const filtered = (res.data || []).filter((p: Product) => p._id !== product._id);
        setRelatedProducts(filtered);
      } catch (error) {
        console.error("Lỗi lấy sản phẩm liên quan:", error);
        setRelatedProducts([]);
      }
    };
    fetchRelated();
  }, [product]);

  const productImages = useMemo(() => {
    if (!product) return [PLACEHOLDER_IMG, PLACEHOLDER_IMG];
    const rawImages = product.images && product.images.length > 0 ? product.images : [product.image];
    const cleaned = rawImages.filter(Boolean).map((src) => normalizeImageUrl(src || ""));
    if (cleaned.length === 0) return [PLACEHOLDER_IMG, PLACEHOLDER_IMG];
    if (cleaned.length === 1) return [cleaned[0], cleaned[0]];
    return cleaned;
  }, [product]);

  // Map màu sắc từ tên sang hex code
  const colorMap: { [key: string]: string } = useMemo(() => ({
    "Đen": "#000000",
    "Trắng": "#FFFFFF",
    "Xám": "#808080",
    "Bạc": "#C0C0C0",
    "Vàng": "#FFD700",
    "Xanh dương": "#0066CC",
    "Xanh lá": "#00CC00",
    "Đỏ": "#DC143C",
    "Hồng": "#FF69B4",
    "Tím": "#800080",
  }), []);

  // Màu sắc biến thể từ product.color
        const colorVariants = useMemo(() => {
          if (!product) return [];

          // Prefer colorStocks if available (has stock info per color)
          if (product.colorStocks && product.colorStocks.length > 0) {
            return product.colorStocks.map((cs) => ({
                name: cs.name,
                value: cs.name, // ← use name directly as value
                hex: Object.entries(colorMap).find(
                  ([key]) => key.toLowerCase() === cs.name.toLowerCase()
                )?.[1] || "#CCCCCC",
                stock: cs.stock,
              }));
          }

          // Fallback to color array
          if (!product.color) return [];
          const colors = Array.isArray(product.color)
            ? product.color
            : (typeof product.color === 'string' ? product.color.split(',').map(c => c.trim()) : []);
              return colors
            .filter(c => c && c.length > 0)
            .map((colorName) => ({
              name: colorName,
              value: colorName, // ← use name directly as value
              hex: Object.entries(colorMap).find(
              ([key]) => key.toLowerCase() === colorName.toLowerCase()
            )?.[1] || "#CCCCCC",
              stock: undefined,
            }));
        }, [product, colorMap]);

  const brandName = resolveEntityName(product?.brand);
  const productDescription =
    product?.desc && product.desc.trim().length > 0
      ? product.desc
      : "<p>Thông tin sản phẩm đang được cập nhật. Vui lòng quay lại sau.</p>";

    const handleQtyChange = (delta: number) => {
      const colorStock = product?.colorStocks?.find(cs => cs.name === selectedColor);
      const maxStock = colorStock?.stock ?? product?.stock ?? Infinity;

      setQuantity((prev) => Math.min(Math.max(1, prev + delta), maxStock));
    };

  if (loading) return <p>Đang tải...</p>;
  if (!product) return <p>Không tìm thấy sản phẩm.</p>;

  return (
    <main className="product-detail-main">
      <div className="breadcrumb">
        <Link to="/">Trang chủ</Link> &gt; <Link to="/products">Sản phẩm</Link> &gt;
      </div>

      <div className="product-detail-container">
        <div className="product-detail-gallery">
          <img src={productImages[selectedImageIndex]} alt={product.name} className="product-main-img" />
          <div className="product-thumbnails">
            {productImages.map((img, idx) => (
              <img
                key={`${img}-${idx}`}
                src={img}
                alt={`Ảnh phụ ${idx + 1}`}
                onClick={() => setSelectedImageIndex(idx)}
                className={selectedImageIndex === idx ? "active" : ""}
              />
            ))}
          </div>
        </div>

        <div className="product-detail-info">
          <h1 className="product-title">{product.name}</h1>

          <div className="product-rating">
            <span className="rating-stars">
              {[...Array(5)].map((_, i) => {
                const roundedRating = Math.round(reviewStats.averageRating);
                return (
                  <i
                    key={i}
                    className={`fa-star ${i < roundedRating ? "fa-solid" : "fa-regular"}`}
                    style={{ color: i < roundedRating ? "#ffcb39" : "#ddd" }}
                  ></i>
                );
              })}
            </span>
            <span className="rating-text">
              {reviewStats.averageRating > 0 ? reviewStats.averageRating.toFixed(1) : "0.0"}
            </span>
            <span className="rating-count">
              | {reviewStats.totalReviews} đánh giá
            </span>
          </div>

          <div className="product-prices">
            <span className="price-sale">{formatCurrency(product.price)}</span>
            {product.oldPrice && <span className="price-origin">{formatCurrency(product.oldPrice)}</span>}
          </div>

          <div className="product-meta">
            <div>
              <span className="label">Thương hiệu</span>
              <span className="brand">{brandName}</span>
            </div>
            <div>
              <span className="label">Danh mục</span>
              <span className="status">{resolveEntityName(product.category, "Đang cập nhật")}</span>
            </div>
          </div>
                            {(() => {
                const colorStock = product.colorStocks?.find(cs => cs.name === selectedColor);
                if (colorStock !== undefined) {
                  return (
                    <div className="product-stock">
                      <span className="label">số lượng</span>
                      <span style={{ color: colorStock.stock > 0 ? "#28a745" : "#d90019", fontWeight: 600 }}>
                        {colorStock.stock > 0 ? `Còn ${colorStock.stock} sản phẩm` : "Hết hàng"}
                      </span>
                    </div>
                  );
                }
                if (product.stock !== undefined) {
                  return (
                    <div className="product-stock">
                      <span className="label">Tồn kho:</span>
                      <span style={{ color: product.stock > 0 ? "#28a745" : "#d90019", fontWeight: 600 }}>
                        {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : "Hết hàng"}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}
          {colorVariants.length > 0 && (
                <div className="product-variants">
                  <span className="label">Màu sắc:</span>
                  <div className="color-variants">
                    {colorVariants.map((color) => (
                      <button
                        key={color.value}
                        className={`color-variant-btn ${selectedColor === color.value ? "active" : ""}`}
                        onClick={() => setSelectedColor(color.value)}
                      >
                        {color.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}


          <div className="product-detail-actions">
            <span className="label">Số lượng:</span>
            <div className="quantity-box">
              <button className="qty-btn" onClick={() => handleQtyChange(-1)}>
                -
              </button>
              <input value={quantity} className="quantity-input" readOnly />
                <button
                  className="qty-btn"
                  onClick={() => handleQtyChange(1)}
                  disabled={(() => {
                    const colorStock = product?.colorStocks?.find(cs => cs.name === selectedColor);
                    const maxStock = colorStock?.stock ?? product?.stock ?? Infinity;
                    return quantity >= maxStock;
                  })()}
                >
                  +
                </button>
            </div>
          </div>

          <div className="product-buttons">
            <button
              className="btn-cart"
              onClick={() => handleAddToCart(product)}
              disabled={addingToCart || buyingNow}
            >
              <i className="fa fa-cart-plus"></i>{" "}
              {addingToCart ? "Đang thêm..." : "Thêm vào giỏ hàng"}
            </button>
            <button
              className="btn-buy"
              onClick={() => handleBuyNow(product)}
              disabled={addingToCart || buyingNow}
            >
              {buyingNow ? "Đang xử lý..." : "Mua ngay"}
            </button>
          </div>
        </div>
      </div>

      <div className="product-detail-tabs">
        <div className="tabs">
          {[
            { key: "desc", label: "Mô tả sản phẩm" },
            { key: "reviews", label: "Bình luận sản phẩm" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key as TabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`tab-content ${activeTab === "desc" ? "active" : ""}`}>
          <h2>Mô tả sản phẩm</h2>
          <div dangerouslySetInnerHTML={{ __html: productDescription }} />
        </div>

        <div className={`tab-content ${activeTab === "reviews" ? "active" : ""}`}>
          <div className="product-review-section">
            {/* Form đánh giá - chỉ hiển thị khi đã đăng nhập */}
            {isAuth && user ? (
              <div className="review-form-section">
                <h3>Viết bình luận của bạn</h3>
                <div className="review-form">
                  <textarea
                    className="review-form-comment"
                    placeholder="Nhập bình luận của bạn..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    rows={4}
                  />
                  <button
                    className="review-form-submit"
                    onClick={handleSubmitReview}
                    disabled={submittingReview || !reviewForm.comment.trim()}
                  >
                    {submittingReview ? "Đang gửi..." : "Gửi bình luận"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="review-login-prompt">
                <p>Vui lòng <Link to="/login">đăng nhập</Link> để bình luận sản phẩm</p>
              </div>
            )}

            {/* Tóm tắt đánh giá */}
            {/* <div className="review-summary">
              <div className="review-score">
                <span className="star-score">
                  <i className="fa-solid fa-star"></i> {reviewStats.averageRating.toFixed(1)}
                </span>
                <span className="review-total">/5</span>
                <div className="review-count">{reviewStats.totalReviews} đánh giá</div>
              </div>
              <div className="review-breakdown">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewStats.ratingDistribution[star] || 0;
                  const percentage = reviewStats.totalReviews > 0
                    ? Math.round((count / reviewStats.totalReviews) * 100)
                    : 0;
                  return (
                    <div key={star} className="review-bar">
                      <span>
                        {star} <i className="fa-solid fa-star"></i>
                      </span>
                      <div className="bar">
                        <div style={{ width: `${percentage}%` }}></div>
                      </div>
                      <span>{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div> */}

            {/* Danh sách đánh giá */}
            {reviewLoading ? (
              <div className="review-loading">Đang tải bình luận ...</div>
            ) : reviews.length === 0 ? (
              <div className="review-empty">Chưa có bình luận nào cho sản phẩm này</div>
            ) : (
              <div className="review-list">
                {reviews
                  .filter((r) => r.isVisible !== false)
                  .map((review) => {
                    const userName = typeof review.userId === "string"
                      ? "Người dùng"
                      : review.userId.name || review.userId.email || "Người dùng";
                    const reviewDate = new Date(review.createdAt).toLocaleString("vi-VN");
                    return (
                      <div key={review._id} className="review-item">
                        <div className="review-user">
                          <div className="review-avatar">{userName.charAt(0).toUpperCase()}</div>
                          <div className="review-info">
                            <span className="review-user-name">{userName}</span>
                            <span className="review-time">{reviewDate}</span>
                          </div>
                        </div>
                        <div className="review-content">{review.comment || "Không có bình luận"}</div>
                        {review.adminReply && review.adminReply.text && (
                          <div className="review-admin-reply">
                            <strong>Phản hồi từ Admin:</strong> {review.adminReply.text}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="promotion-slider">
          <div className="slider-header">
            <span>SẢN PHẨM LIÊN QUAN</span>
          </div>
          <div className="slider-container">
            <button
              className="slide-btn prev"
              onClick={() => handleSlide(relatedSliderRef, "prev")}
            >
              ‹
            </button>

            <div className="slider-list" ref={relatedSliderRef}>
              {relatedProducts.slice(0, 12).map((relatedProduct) => {
                const cardProduct = toCardProduct(relatedProduct);
                return (
                  <ProductCard
                    key={relatedProduct._id}
                    product={cardProduct}
                    toNumber={toNumber}
                    formatPrice={formatPrice}
                    calculateSalePercent={calculateSalePercent}
                    className="product-card--slider"
                  />
                );
              })}
            </div>

            <button
              className="slide-btn next"
              onClick={() => handleSlide(relatedSliderRef, "next")}
            >
              ›
            </button>
          </div>
        </section>
      )}

    </main>
  );
};

export default ProductDetail;
