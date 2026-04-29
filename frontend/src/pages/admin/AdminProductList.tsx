import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getToken } from "../../services/authService";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./css/admin-product-list.css";

interface Product {
  _id: string;
  name: string;
  code?: string;
  price: number;
  oldPrice?: number;
  salePercent?: number;
  image?: string;
  isActive?: boolean;
  color?: string;
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

const AdminProductList = () => {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchProducts = useCallback(async (search: string = "", category: string = "", brand: string = "") => {
    try {
      setLoading(true);
      const token = getToken();
      const params = new URLSearchParams();
      
      if (showInactive) {
        params.append("isActive", "false");
      } else {
        params.append("isActive", "true");
      }
      
      if (search.trim()) {
        params.append("q", search.trim());
      }
      
      if (category) {
        params.append("category", category);
      }
      
      if (brand) {
        params.append("brand", brand);
      }
      
      const url = `http://localhost:5000/api/products?${params.toString()}`;
      
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFilteredProducts(res.data);
    } catch (error) {
      console.error("Lỗi lấy sản phẩm", error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Lỗi khi tải danh sách sản phẩm");
      } else {
        toast.error("Lỗi khi tải danh sách sản phẩm");
      }
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const fetchCategories = async () => {
    try {
      const token = getToken();
      const res = await axios.get("http://localhost:5000/api/categories?isActive=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCategories(res.data);
    } catch (error) {
      console.error("Lỗi lấy danh mục", error);
    }
  };

  const fetchBrands = async () => {
    try {
      const token = getToken();
      const res = await axios.get("http://localhost:5000/api/brands?isActive=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setBrands(res.data);
    } catch (error) {
      console.error("Lỗi lấy thương hiệu", error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  // Debounce search và fetch products với filter
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(searchTerm, selectedCategory, selectedBrand);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, showInactive, selectedCategory, selectedBrand, fetchProducts]);

  const deleteProduct = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? "ẩn" : "hiện";
    if (!window.confirm(`Bạn chắc chắn muốn ${action} sản phẩm này?`)) return;

    try {
      const token = getToken();
      const res = await axios.delete(`http://localhost:5000/api/products/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      toast.success(res.data.message || `${action === "ẩn" ? "Ẩn" : "Hiện"} sản phẩm thành công!`);
      fetchProducts(searchTerm, selectedCategory, selectedBrand);
    } catch (error) {
      const action = currentStatus ? "ẩn" : "hiện";
      console.error(`Lỗi ${action} sản phẩm`, error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || `Lỗi khi ${action} sản phẩm`);
      } else {
        toast.error(`Lỗi khi ${action} sản phẩm`);
      }
    }
  };

  // Tính toán phân trang
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top khi chuyển trang
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Reset về trang 1 khi filter thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredProducts.length]);

  if (loading) {
    return (
      <div className="product-list-content" style={{ textAlign: "center", padding: "50px" }}>
        <div>Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="product-list-content">
      <div className="product-list-header">
        <h2>Danh sách sản phẩm</h2>

        <Link to="/admin/products/add">
          <button className="add-btn">
            <i className="fa-solid fa-plus"></i> Thêm sản phẩm
          </button>
        </Link>
      </div>

      <div className="product-list-box">
        <div className="product-list-tabs">
          <button 
            className={`tab ${!showInactive ? "active" : ""}`}
            onClick={() => setShowInactive(false)}
          >
            Đang hoạt động
          </button>
          <button 
            className={`tab ${showInactive ? "active" : ""}`}
            onClick={() => setShowInactive(true)}
          >
            Đã ẩn
          </button>
        </div>

        {/* Bộ lọc */}
        <div className="product-list-filters">
          <div className="search-bar">
            <i className="fa-solid fa-search"></i>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Tất cả loại</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">Tất cả thương hiệu</option>
            {brands.map((brand) => (
              <option key={brand._id} value={brand._id}>
                {brand.name}
              </option>
            ))}
          </select>

          {(selectedCategory || selectedBrand || searchTerm) && (
            <button
              className="filter-btn"
              onClick={() => {
                setSelectedCategory("");
                setSelectedBrand("");
                setSearchTerm("");
              }}
            >
              <i className="fa-solid fa-times"></i> Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Bảng sản phẩm */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>Hình ảnh</th>
                <th>Mã sản phẩm</th>
                <th>Tên sản phẩm</th>
                <th>Loại</th>
                <th>Thương hiệu</th>
                <th>Màu sắc</th>
                <th>Giá</th>
                <th>Hành động</th>
              </tr>
            </thead>

            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "20px" }}>
                    {loading ? "Đang tải..." : "Không có sản phẩm nào"}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => (
                <tr key={p._id} style={{ opacity: p.isActive === false ? 0.6 : 1 }}>
                  <td><input type="checkbox" /></td>

                  <td>
                    <img
                      src={p.image?.startsWith('http') ? p.image : `http://localhost:5000/${p.image?.replace(/^\/?/, "") || ""}`}
                      alt={p.name}
                      width={36}
                      height={36}
                      style={{ borderRadius: 5, objectFit: "cover" }}
                      onError={(e) => (e.currentTarget.src = "/fallback.jpg")}
                    />
                  </td>

                  <td>{p.code || p._id}</td>

                  {/* Tên sản phẩm màu đỏ */}
                  <td className="product-name">{p.name}</td>

                  <td>{p.category?.name || "Chưa phân loại"}</td>
                  <td>{p.brand?.name || "Không có"}</td>
                  <td>{p.color || "-"}</td>
                  <td>
                    {p.salePercent && p.salePercent > 0 && p.oldPrice ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {/* Giá bán (sau giảm) - màu đỏ */}
                        <div style={{ 
                          color: "#dc3545",
                          fontWeight: 600,
                          fontSize: "14px"
                        }}>
                          {Number(p.price).toLocaleString("vi-VN")}₫
                        </div>
                        {/* Giá gốc (gạch ngang) */}
                        <div style={{ 
                          color: "#6b7280",
                          fontSize: "12px",
                          textDecoration: "line-through"
                        }}>
                          {Number(p.oldPrice).toLocaleString("vi-VN")}₫
                        </div>
                        {/* Badge phần trăm giảm */}
                        <div style={{ 
                          color: "#dc3545",
                          fontSize: "11px",
                          fontWeight: 600,
                          backgroundColor: "#fee2e2",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                          width: "fit-content"
                        }}>
                          -{p.salePercent}%
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        color: "#1f2937",
                        fontWeight: 600,
                        fontSize: "14px"
                      }}>
                        {Number(p.price).toLocaleString("vi-VN")}₫
                      </div>
                    )}
                  </td>

                  <td>
                    <Link
                      to={`/admin/products/edit/${p._id}`}
                      className="edit-btn"
                    >
                      Sửa
                    </Link>

                    <button
                      className="delete-btn"
                      onClick={() => deleteProduct(p._id, p.isActive !== false)}
                    >
                      {p.isActive !== false ? "Ẩn" : "Hiện"}
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {filteredProducts.length > 0 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{ 
                opacity: currentPage === 1 ? 0.5 : 1, 
                cursor: currentPage === 1 ? "not-allowed" : "pointer" 
              }}
              title="Trang trước"
            >
              <i className="fa-solid fa-angle-left"></i>
            </button>
            <span>
              Trang {currentPage} / {totalPages} ({filteredProducts.length} sản phẩm)
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{ 
                opacity: currentPage === totalPages ? 0.5 : 1, 
                cursor: currentPage === totalPages ? "not-allowed" : "pointer" 
              }}
              title="Trang sau"
            >
              <i className="fa-solid fa-angle-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductList;
