import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../user/css/style.css";
import "../user/css/product-list.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import ProductCard from "../../components/ProductCard";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { upsertStoredCartItem } from "../../services/cartStorage";

interface Product {
  _id: string;
  name: string;
  image: string;
  price: number | string | { $numberDecimal?: string };          // FIX Decimal128
  oldPrice?: number | string | { $numberDecimal?: string };      // FIX Decimal128
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
  brand?: {
    _id: string;
    name: string;
    slug: string;
  };
  salePercent?: number;
  tag?: string | null;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const itemsPerPage = 12;

  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get("search") || "";
  const { user } = useAuth();
  const userId = user?.id;

  // Hàm xóa tìm kiếm
  const handleClearSearch = () => {
    setSearchTerm("");
    navigate("/products");
  };

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
const calculateSalePercent = (product: Product) => {
  const price = toNumber(product.price);
  const oldPrice = toNumber(product.oldPrice);

  if (oldPrice > price && oldPrice > 0) {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  return product.salePercent || 0;
};
  // Fetch categories and brands
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/categories?isActive=true"),
          axios.get("http://localhost:5000/api/brands?isActive=true"),
        ]);
        setCategories(categoriesRes.data);
        setBrands(brandsRes.data);
      } catch (err) {
        console.error("Lỗi lấy danh mục/thương hiệu", err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = query
          ? `http://localhost:5000/api/products?q=${encodeURIComponent(query)}`
          : "http://localhost:5000/api/products";

        const res = await axios.get<Product[]>(url);

        setProducts(res.data);
        setSearchTerm(query);
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
        setError("Không thể tải sản phẩm từ server.");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [query]);

  // Add to cart
  const handleAddToCart = async (product: Product) => {
    const finalPrice = toNumber(product.price);
    upsertStoredCartItem({
      productId: product._id,
      name: product.name,
      image: product.image,
      price: finalPrice,
      quantity: 1,
    });

    if (!userId) {
      toast.success(`Đã lưu "${product.name}" vào giỏ hàng trên thiết bị.`);
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/cart/add", {
        userId,
        productId: product._id,
        quantity: 1,
        price: finalPrice,
      });
      toast.success(`Đã thêm "${product.name}" vào giỏ hàng!`);
    } catch (err) {
      console.error(err);
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage = error.response?.data?.message || "Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.";
      toast.error(errorMessage);
    }
  };

  // Checkbox filter
  const handleCheckboxChange = (
    value: string,
    setFilter: React.Dispatch<React.SetStateAction<string[]>>,
    currentFilter: string[]
  ) => {
    const newFilter = currentFilter.includes(value)
      ? currentFilter.filter((v) => v !== value)
      : [...currentFilter, value];
    setFilter(newFilter);
    setCurrentPage(1);
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    const price = toNumber(product.price);

    const matchesName = product.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPrice =
      priceFilter.length === 0 ||
      priceFilter.some((range) => {
        switch (range) {
          case "under3":
            return price < 10000000;
          case "5to10":
            return price >= 10000000 && price <= 20000000;
          case "20to30":
            return price >= 20000000 && price <= 30000000;
          case "above30":
            return price > 30000000;
          default:
            return true;
        }
      });

    const matchesBrand =
      brandFilter.length === 0 ||
      brandFilter.some((brandId) => product.brand?._id === brandId);

    const matchesCategory =
      categoryFilter.length === 0 ||
      categoryFilter.some((categoryId) => product.category?._id === categoryId);

    return matchesName && matchesPrice && matchesBrand && matchesCategory;
  });
// Sort products 
  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = toNumber(a.price);
    const priceB = toNumber(b.price);

    if (sortOption === "asc") return priceA - priceB;
    if (sortOption === "desc") return priceB - priceA;

    if (sortOption === "sale") {
      const saleA = calculateSalePercent(a);
      const saleB = calculateSalePercent(b);
      return saleB - saleA;
    }

    if (sortOption === "newest") return b._id.localeCompare(a._id);

    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Format price

  const formatPrice = (price: number | string | { $numberDecimal?: string } | undefined): string => {
    return toNumber(price).toLocaleString("vi-VN") + "₫";
  };


  return (
    <div className="contact-main">
      <div className="breadcrumb">
        <Link to="/home">Trang chủ</Link> &gt; <span>Sản phẩm</span>
      </div>

      <main className="product-list-main">
        <div className="product-list-container">

          {/* -------------------------------- */}
          {/* SIDEBAR */}
          {/* -------------------------------- */}
          <section className="product-sidebar">

            {/* Price filter */}
            <div className="sidebar-section">
              <div className="sidebar-title">Khoảng giá</div>
              <ul className="price-list">
                {[
                  { id: "under3", label: "Dưới 10.000.000đ" },
                  { id: "5to10", label: "10.000.000đ - 20.000.000đ" },
                  { id: "20to30", label: "20.000.000đ - 30.000.000đ" },
                  { id: "above30", label: "Trên 30.000.000đ" },
                ].map((p) => (
                  <li key={p.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={priceFilter.includes(p.id)}
                        onChange={() => handleCheckboxChange(p.id, setPriceFilter, priceFilter)}
                      />
                      <span>{p.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category filter */}
            <div className="sidebar-section">
              <div className="sidebar-title">Danh mục</div>
              <ul>
                {categories.map((category) => (
                  <li key={category._id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={categoryFilter.includes(category._id)}
                        onChange={() => handleCheckboxChange(category._id, setCategoryFilter, categoryFilter)}
                      />
                      <span>{category.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* Brand filter */}
            <div className="sidebar-section">
              <div className="sidebar-title">Thương hiệu</div>
              <ul>
                {brands.map((brand) => (
                  <li key={brand._id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={brandFilter.includes(brand._id)}
                        onChange={() => handleCheckboxChange(brand._id, setBrandFilter, brandFilter)}
                      />
                      <span>{brand.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

          </section>

          {/* -------------------------------- */}
          {/* PRODUCT LIST */}
          {/* -------------------------------- */}
          <section className="product-list-content">
            <div className="product-list-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {searchTerm ? (
                  <>
                    <span>Kết quả tìm kiếm: "<strong>{searchTerm}</strong>" ({filteredProducts.length} sản phẩm)</span>
                    <button
                      onClick={handleClearSearch}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e8e8e8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                    >
                      <i className="fa-solid fa-times"></i>
                      Xóa tìm kiếm
                    </button>
                  </>
                ) : (
                  <span>Tất cả sản phẩm <strong>({filteredProducts.length})</strong></span>
                )}
              </div>

              <select
                className="sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="">Sắp xếp</option>
                <option value="newest">Mới nhất</option>
                <option value="asc">Giá tăng dần</option>
                <option value="desc">Giá giảm dần</option>
                <option value="sale">Khuyến mãi mạnh nhất</option>
              </select>
            </div>

            {/* Loading */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", fontSize: "18px", color: "#666" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "10px" }}></i>
                Đang tải sản phẩm...
              </div>
            ) : error ? (
              <div style={{ textAlign: "center", padding: "60px", fontSize: "18px", color: "#d90019" }}>
                <i className="fa-solid fa-exclamation-triangle" style={{ marginRight: "10px" }}></i>
                {error}
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px", fontSize: "18px", color: "#666" }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: "48px", marginBottom: "20px", display: "block", color: "#ccc" }}></i>
                Không tìm thấy sản phẩm nào.
                {(priceFilter.length > 0 || brandFilter.length > 0 || categoryFilter.length > 0 || searchTerm) && (
                  <div style={{ marginTop: "15px" }}>
                    <button
                      onClick={() => {
                        setPriceFilter([]);
                        setBrandFilter([]);
                        setCategoryFilter([]);
                        setSearchTerm("");
                      }}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "#d90019",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        marginTop: "10px"
                      }}
                    >
                      <i className="fa-solid fa-times"></i> Xóa bộ lọc
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="product-list-grid"
                style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}
              >
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    // onAddToCart={handleAddToCart}
                    toNumber={toNumber}
                    formatPrice={formatPrice}
                    calculateSalePercent={calculateSalePercent}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    className={i + 1 === currentPage ? "active" : ""}
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ProductList;
