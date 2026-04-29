import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { getToken } from "../../services/authService";
import "@fortawesome/fontawesome-free/css/all.min.css";

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BrandFormData {
  name: string;
  description: string;
  isActive: boolean;
}

const AdminBrands: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<BrandFormData>({
    name: "",
    description: "",
    isActive: true,
  });

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/brands");
      setBrands(res.data);
    } catch (error) {
      console.error("Lỗi lấy thương hiệu", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Lỗi khi tải danh sách thương hiệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "isActive" ? (e.target as HTMLInputElement).checked : value,
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getToken();
      const submitData = new FormData();
      
      submitData.append("name", formData.name);
      submitData.append("description", formData.description);
      submitData.append("isActive", formData.isActive.toString());

      if (editingBrand) {
        // Cập nhật
        await axios.put(
          `http://localhost:5000/api/brands/${editingBrand._id}`,
          submitData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );
        toast.success("Cập nhật thương hiệu thành công!");
      } else {
        // Thêm mới
        await axios.post("http://localhost:5000/api/brands", submitData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Thêm thương hiệu thành công!");
      }
      setShowAddForm(false);
      setEditingBrand(null);
      setFormData({ name: "", description: "", isActive: true });
      fetchBrands();
    } catch (error) {
      console.error("Lỗi", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Có lỗi xảy ra!");
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description,
      isActive: brand.isActive,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa thương hiệu này?")) return;

    try {
      const token = getToken();
      await axios.delete(`http://localhost:5000/api/brands/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      toast.success("Xóa thương hiệu thành công!");
      fetchBrands();
    } catch (error) {
      console.error("Lỗi xóa thương hiệu", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Lỗi khi xóa thương hiệu");
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingBrand(null);
    setFormData({ name: "", description: "", isActive: true });
  };

  if (loading) {
    return <div style={{ padding: "50px", textAlign: "center" }}>Đang tải...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Quản lý thương hiệu</h2>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingBrand(null);
            setFormData({ name: "", description: "", isActive: true });
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#45a049"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#4CAF50"}
        >
          <i className="fa-solid fa-plus"></i> Thêm thương hiệu
        </button>
      </div>

      {showAddForm && (
        <div
          style={{
            backgroundColor: "#f9f9f9",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #ddd",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Tên thương hiệu *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Mô tả
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Đang hoạt động
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#45a049"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#4CAF50"}
              >
                <i className={`fa-solid ${editingBrand ? "fa-save" : "fa-plus"}`}></i> {editingBrand ? "Cập nhật" : "Thêm mới"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#5a6268"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#6c757d"}
              >
                <i className="fa-solid fa-times"></i> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left", fontWeight: "600" }}>Tên thương hiệu</th>
              <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left", fontWeight: "600" }}>Slug</th>
              <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "left", fontWeight: "600" }}>Mô tả</th>
              <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center", fontWeight: "600" }}>Thứ tự</th>
              <th style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center", fontWeight: "600" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "20px", textAlign: "center" }}>
                  Không có thương hiệu nào
                </td>
              </tr>
            ) : (
              brands
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((brand) => (
                <tr key={brand._id} style={{ transition: "background-color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9f9f9"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
                  <td style={{ padding: "12px", border: "1px solid #ddd", fontWeight: "500" }}>{brand.name}</td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", color: "#666", fontSize: "14px" }}>{brand.slug}</td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", color: "#666", fontSize: "14px" }}>
                    {brand.description || "-"}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      backgroundColor: "#e3f2fd", 
                      color: "#1976d2",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {brand.sortOrder}
                    </span>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    <button
                      onClick={() => handleEdit(brand)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "5px",
                        fontSize: "13px",
                        fontWeight: "500",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1976d2"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#2196F3"}
                    >
                      <i className="fa-solid fa-edit"></i> Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(brand._id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "500",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#d32f2f"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f44336"}
                    >
                      <i className="fa-solid fa-trash"></i> Ẩn
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBrands;

