import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getToken } from "../../services/authService";
import {
  getAllNews,
  createNews,
  updateNews,
  deleteNews,
  type News,
} from "../../services/newsService";
import "@fortawesome/fontawesome-free/css/all.min.css";

const NewsManager: React.FC = () => {
  const [newsList, setNewsList] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    author: "Admin",
    isActive: true,
    isFeatured: false,
  });

  const fetchNews = async () => {
    try {
      setLoading(true);
      const news = await getAllNews();
      setNewsList(news);
    } catch (error) {
      console.error("Lỗi lấy tin tức", error);
      toast.error("Lỗi khi tải danh sách tin tức");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "isActive" || name === "isFeatured"
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("content", formData.content);
      submitData.append("summary", formData.summary);
      submitData.append("author", formData.author);
      submitData.append("isActive", formData.isActive.toString());
      submitData.append("isFeatured", formData.isFeatured.toString());

      if (imageFile) {
        submitData.append("image", imageFile);
      } else if (editingNews?.image && !imagePreview) {
        submitData.append("image", editingNews.image);
      }

      if (editingNews) {
        await updateNews(editingNews._id, submitData);
        toast.success("Cập nhật tin tức thành công!");
      } else {
        await createNews(submitData);
        toast.success("Thêm tin tức thành công!");
      }

      setShowAddForm(false);
      setEditingNews(null);
      setFormData({
        title: "",
        content: "",
        summary: "",
        author: "Admin",
        isActive: true,
        isFeatured: false,
      });
      setImageFile(null);
      setImagePreview("");
      fetchNews();
    } catch (error) {
      console.error("Lỗi", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Có lỗi xảy ra!");
    }
  };

  const handleEdit = (news: News) => {
    setEditingNews(news);
    setFormData({
      title: news.title,
      content: news.content,
      summary: news.summary || "",
      author: news.author || "Admin",
      isActive: news.isActive ?? true,
      isFeatured: news.isFeatured ?? false,
    });
    if (news.image) {
      setImagePreview(
        news.image.startsWith("http")
          ? news.image
          : `http://localhost:5000/${news.image}`
      );
    }
    setImageFile(null);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa tin tức này?")) return;

    try {
      await deleteNews(id);
      toast.success("Xóa tin tức thành công!");
      fetchNews();
    } catch (error) {
      console.error("Lỗi xóa tin tức", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Lỗi khi xóa tin tức");
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingNews(null);
    setFormData({
      title: "",
      content: "",
      summary: "",
      author: "Admin",
      isActive: true,
      isFeatured: false,
    });
    setImageFile(null);
    setImagePreview("");
  };

  if (loading) {
    return <div style={{ padding: "50px", textAlign: "center" }}>Đang tải...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2>Quản lý tin tức</h2>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingNews(null);
            setFormData({
              title: "",
              content: "",
              summary: "",
              author: "Admin",
              isActive: true,
              isFeatured: false,
            });
            setImageFile(null);
            setImagePreview("");
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#45a049")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4CAF50")}
        >
          <i className="fa-solid fa-plus"></i> Thêm tin tức
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
                Tiêu đề *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Tóm tắt
              </label>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Nội dung *
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows={10}
                placeholder="Nhập nội dung tin tức (xuống dòng bằng phím Enter)..."
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  resize: "vertical",
                }}
              />
              <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
                💡 Tip: Xuống dòng bằng phím Enter. Mỗi đoạn văn sẽ được hiển thị riêng biệt.
              </small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Tác giả
              </label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Hình ảnh
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    marginTop: "10px",
                    maxWidth: "300px",
                    maxHeight: "200px",
                    borderRadius: "4px",
                  }}
                />
              )}
            </div>

            <div style={{ marginBottom: "15px", display: "flex", gap: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Đang hoạt động
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleInputChange}
                />
                Tin nổi bật
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
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#45a049")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4CAF50")}
              >
                <i className={`fa-solid ${editingNews ? "fa-save" : "fa-plus"}`}></i>{" "}
                {editingNews ? "Cập nhật" : "Thêm mới"}
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
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5a6268")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6c757d")}
              >
                <i className="fa-solid fa-times"></i> Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "white",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "left",
                  fontWeight: "600",
                }}
              >
                Tiêu đề
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "left",
                  fontWeight: "600",
                }}
              >
                Tác giả
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Lượt xem
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Trạng thái
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Nổi bật
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Ngày tạo
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Hành động
              </th>
            </tr>
          </thead>
          <tbody>
            {newsList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "20px", textAlign: "center" }}>
                  Không có tin tức nào
                </td>
              </tr>
            ) : (
              newsList.map((news) => (
                <tr
                  key={news._id}
                  style={{
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                >
                  <td
                    style={{
                      padding: "12px",
                      border: "1px solid #ddd",
                      fontWeight: "500",
                      maxWidth: "300px",
                    }}
                  >
                    {news.title}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", color: "#666" }}>
                    {news.author || "Admin"}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    {news.views || 0}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: news.isActive ? "#4CAF50" : "#f44336",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {news.isActive ? "Hoạt động" : "Tạm khóa"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    {news.isFeatured ? (
                      <i className="fa-solid fa-star" style={{ color: "#FFD700" }}></i>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center", fontSize: "13px", color: "#666" }}>
                    {news.createdAt
                      ? new Date(news.createdAt).toLocaleDateString("vi-VN")
                      : "-"}
                  </td>
                  <td style={{ padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>
                    <button
                      onClick={() => handleEdit(news)}
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
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1976d2")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2196F3")}
                    >
                      <i className="fa-solid fa-edit"></i> Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(news._id)}
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
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#d32f2f")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f44336")}
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

export default NewsManager;

