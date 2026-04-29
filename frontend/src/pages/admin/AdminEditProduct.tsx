import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { getToken } from "../../services/authService";
import "./css/admin-edit-product.css";

interface Product {
  name: string;
  code: string;
  price: number;
  salePercent: number;
  category: string;
  brand: string;
  image: string;
  images?: string[];
  tag?: string | null;
  color?: string;
  colorStocks?: Array<{ name: string; stock: number }>;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

const AdminEditProduct: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product>({
    name: "",
    code: "",
    price: 0,
    salePercent: 0,
    category: "",
    brand: "",
    image: "",
    color: "",
    colorStocks: [],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [existingImages, setExistingImages] = useState<string[]>([]); // Ảnh phụ hiện có
  const [newImages, setNewImages] = useState<File[]>([]); // Ảnh phụ mới upload
  const [originalPrice, setOriginalPrice] = useState<string>(""); // Giá gốc
  const [colorStocks, setColorStocks] = useState<Array<{ name: string; stock: number }>>([]);

  // Fetch categories và brands
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/categories/active"),
          axios.get("http://localhost:5000/api/brands/active"),
        ]);
        setCategories(categoriesRes.data);
        setBrands(brandsRes.data);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu", error);
      }
    };
    fetchData();
  }, []);

  // Fetch sản phẩm theo ID
  useEffect(() => {
    if (!id) {
      setError("Sản phẩm không tồn tại");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/products/${id}`);
        const data = res.data;
        const price = data.price || 0;
        const salePercent = data.salePercent || 0;
        
        // Tính giá gốc từ giá hiện tại và phần trăm giảm giá
        let calculatedOriginalPrice = price;
        if (salePercent > 0 && price > 0) {
          calculatedOriginalPrice = Math.round(price / (1 - salePercent / 100));
        }
        
        setProduct({
          name: data.name || "",
          code: data.code || "",
          price: price,
          salePercent: salePercent,
          category: data.category?._id || data.category || "",
          brand: data.brand?._id || data.brand || "",
          image: data.image || "",
          images: data.images || [],
          tag: data.tag || null,
          color: Array.isArray(data.color) ? data.color.join(", ") : (data.color || ""),
          colorStocks: data.colorStocks || [],
        });
        
        // Set colorStocks
        if (data.colorStocks && Array.isArray(data.colorStocks) && data.colorStocks.length > 0) {
          setColorStocks(data.colorStocks);
        } else {
          setColorStocks([]);
        }
        
        // Set giá gốc
        setOriginalPrice(calculatedOriginalPrice.toString());
        
        // Set tag
        setTag(data.tag || "");
        // Set image preview nếu có
        if (data.image) {
          setImagePreview(data.image.startsWith("http") ? data.image : `http://localhost:5000/${data.image}`);
        }
        // Set existing images (ảnh phụ)
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          setExistingImages(data.images);
        }
      } catch (err) {
        console.error("Lỗi lấy sản phẩm", err);
        setError("Không thể tải sản phẩm. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProduct((prev) => ({
      ...prev,
      [name]: name === "price" || name === "salePercent" ? Number(value) : value,
    }));
  };

  // Xử lý màu sắc với số lượng
  const addColorStock = () => {
    setColorStocks([...colorStocks, { name: "", stock: 0 }]);
  };

  const removeColorStock = (index: number) => {
    setColorStocks(colorStocks.filter((_, i) => i !== index));
  };

  const updateColorStock = (index: number, field: "name" | "stock", value: string | number) => {
    const updated = [...colorStocks];
    updated[index] = { ...updated[index], [field]: value };
    setColorStocks(updated);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetailImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileArray = Array.from(selectedFiles);
      setNewImages(prev => [...prev, ...fileArray]);
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getToken();
      const submitData = new FormData();
      
      submitData.append("name", product.name);
      submitData.append("code", product.code || "");
      submitData.append("price", product.price.toString());
      submitData.append("salePercent", (product.salePercent || 0).toString());
      submitData.append("category", product.category);
      submitData.append("brand", product.brand);
      submitData.append("colorStocks", JSON.stringify(colorStocks));
      submitData.append("tag", tag || "");
      
      // Nếu có file ảnh mới, append file
      if (imageFile) {
        submitData.append("image", imageFile);
      } else if (product.image) {
        // Nếu không có file mới nhưng có image URL
        submitData.append("image", product.image);
      }

      // Gửi danh sách ảnh phụ hiện có (còn lại sau khi xóa)
      if (existingImages.length > 0) {
        submitData.append("existingImages", JSON.stringify(existingImages));
      }

      // Gửi ảnh phụ mới
      newImages.forEach((fileItem) => {
        submitData.append("images", fileItem);
      });

      await axios.put(`http://localhost:5000/api/products/${id}`, submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Cập nhật sản phẩm thành công!");
      navigate("/admin/products");
    } catch (err) {
      console.error("Lỗi cập nhật sản phẩm", err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Cập nhật sản phẩm thất bại!");
    }
  };

  if (loading) return <div>Đang tải sản phẩm...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="product-form-container">
      <h2>Chỉnh sửa sản phẩm</h2>
      <form onSubmit={handleSubmit} className="product-form">
        <label>
          Tên sản phẩm
          <input
            type="text"
            name="name"
            value={product.name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Mã sản phẩm
          <input
            type="text"
            name="code"
            value={product.code}
            onChange={handleChange}
          />
        </label>

        <label>
          Giá gốc (₫)
          <input
            type="number"
            value={originalPrice}
            onChange={(e) => {
              const newOriginalPrice = e.target.value;
              setOriginalPrice(newOriginalPrice);
              // Tự động tính giá giảm nếu có % giảm
              if (product.salePercent && Number(product.salePercent) > 0 && newOriginalPrice) {
                const origPrice = Number(newOriginalPrice);
                const discountedPrice = Math.round(origPrice * (1 - Number(product.salePercent) / 100));
                setProduct((prev) => ({ ...prev, price: discountedPrice }));
              } else if (newOriginalPrice) {
                setProduct((prev) => ({ ...prev, price: Number(newOriginalPrice) }));
              }
            }}
            placeholder="Nhập giá gốc"
            required
            min="0"
          />
        </label>

        <label>
          Màu sắc (nhiều màu)
          <input
            type="text"
            name="color"
            value={product.color || ""}
            onChange={handleChange}
            placeholder="Nhập các màu cách nhau bởi dấu phẩy. Ví dụ: Đen, Trắng, Xám, Bạc"
          />
        </label>

        <label>
          Phần trăm giảm giá (%)
          <input
            type="number"
            name="salePercent"
            value={product.salePercent}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "" || (Number(value) >= 0 && Number(value) <= 100)) {
                setProduct((prev) => ({
                  ...prev,
                  salePercent: value === "" ? 0 : Number(value),
                }));
                // Tự động tính giá giảm khi thay đổi %
                if (originalPrice && Number(value) > 0) {
                  const origPrice = Number(originalPrice);
                  const discountedPrice = Math.round(origPrice * (1 - Number(value) / 100));
                  setProduct((prev) => ({ ...prev, price: discountedPrice }));
                } else if (originalPrice) {
                  setProduct((prev) => ({ ...prev, price: Number(originalPrice) }));
                }
              }
            }}
            placeholder="0"
            min="0"
            max="100"
          />
        </label>

        <label>
          Giá bán (₫) - Tự động tính
          <input
            type="number"
            name="price"
            value={product.price}
            onChange={handleChange}
            placeholder="Tự động tính từ giá gốc và % giảm"
            required
            min="0"
            readOnly
            style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
          />
        </label>

        <label>
          Màu sắc và số lượng
          <div style={{ marginBottom: "10px" }}>
            <button
              type="button"
              onClick={addColorStock}
              style={{
                padding: "8px 16px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px",
                marginBottom: "15px"
              }}
            >
              <i className="fa fa-plus" style={{ marginRight: "5px" }}></i>
              Thêm màu
            </button>
          </div>
          
          {colorStocks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {colorStocks.map((colorStock, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    padding: "10px",
                    background: "#f8f9fa",
                    borderRadius: "5px",
                    border: "1px solid #ddd"
                  }}
                >
                  <input
                    type="text"
                    value={colorStock.name}
                    onChange={(e) => updateColorStock(index, "name", e.target.value)}
                    placeholder="Tên màu (ví dụ: Đen)"
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  />
                  <input
                    type="number"
                    value={colorStock.stock}
                    onChange={(e) => updateColorStock(index, "stock", parseInt(e.target.value) || 0)}
                    placeholder="Số lượng"
                    min="0"
                    style={{
                      width: "120px",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeColorStock(index)}
                    style={{
                      padding: "8px 12px",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {colorStocks.length === 0 && (
            <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
              Nhấn "Thêm màu" để thêm màu sắc và số lượng cho từng màu. Số lượng sẽ được tính tự động từ tổng số lượng các màu.
            </small>
          )}
        </label>

        <label>
          Loại sản phẩm
          <select
            name="category"
            value={product.category}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              fontSize: "16px",
            }}
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Thương hiệu
          <select
            name="brand"
            value={product.brand}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              fontSize: "16px",
            }}
          >
            <option value="">-- Chọn thương hiệu --</option>
            {brands.map((br) => (
              <option key={br._id} value={br._id}>
                {br.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tag sản phẩm
          <select
            name="tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              fontSize: "16px",
              marginTop: "8px"
            }}
          >
            <option value="">-- Không có tag --</option>
            <option value="sale">Khuyến mãi</option>
            <option value="new">Mới nhất</option>
            <option value="featured">Gợi Ý</option>
          </select>
          <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
            Chọn 1 tag để hiển thị sản phẩm trong các section tương ứng
          </small>
        </label>

        <label>
          Ảnh chính
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          {imagePreview && (
            <div style={{ marginTop: "10px" }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: "200px",
                  maxHeight: "200px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  objectFit: "contain",
                  padding: "4px"
                }}
              />
            </div>
          )}
          {!imageFile && product.image && !imagePreview && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ fontSize: "12px", color: "#666" }}>Ảnh hiện tại:</p>
              <img
                src={product.image.startsWith("http") ? product.image : `http://localhost:5000/${product.image}`}
                alt="Current"
                style={{
                  maxWidth: "200px",
                  maxHeight: "200px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  objectFit: "contain",
                  padding: "4px"
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </label>

        <label>
          Ảnh phụ (có thể chọn nhiều)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleDetailImagesChange}
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
            Có thể chọn nhiều ảnh cùng lúc (tối đa 10 ảnh)
          </small>

          {/* Hiển thị ảnh phụ hiện có */}
          {existingImages.length > 0 && (
            <div style={{ marginTop: "15px" }}>
              <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px" }}>Ảnh phụ hiện có:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {existingImages.map((img, index) => {
                  const imgUrl = img.startsWith("http") ? img : `http://localhost:5000/${img}`;
                  return (
                    <div key={index} style={{ position: "relative", display: "inline-block" }}>
                      <img
                        src={imgUrl}
                        alt={`Detail ${index + 1}`}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          padding: "4px"
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        style={{
                          position: "absolute",
                          top: "-5px",
                          right: "-5px",
                          background: "#d90019",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          cursor: "pointer",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hiển thị ảnh phụ mới */}
          {newImages.length > 0 && (
            <div style={{ marginTop: "15px" }}>
              <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px" }}>Ảnh phụ mới:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {newImages.map((fileItem, index) => (
                  <div key={index} style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={URL.createObjectURL(fileItem)}
                      alt={`New detail ${index + 1}`}
                      style={{
                        width: "100px",
                        height: "100px",
                        objectFit: "cover",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "4px"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        background: "#d90019",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        cursor: "pointer",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </label>

        <button type="submit" className="submit-btn">
          Cập nhật sản phẩm
        </button>
      </form>
    </div>
  );
};

export default AdminEditProduct;
