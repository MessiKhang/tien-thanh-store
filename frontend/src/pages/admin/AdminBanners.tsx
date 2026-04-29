import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type Banner,
} from "../../services/bannerService";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./css/admin-banners.css";

const normalizeImageUrl = (src?: string) => {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const cleanPath = src.replace(/^\/+/, "").replace(/\\/g, "/");
  return `http://localhost:5000/${cleanPath}`;
};

const AdminBanners: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    discountText: "",
    link: "#",
    isActive: true,
    sortOrder: 0,
  });

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const data = await getBanners();
      setBanners(data);
    } catch (error) {
      console.error("Lỗi lấy banners", error);
      toast.error("Lỗi khi tải danh sách banner");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "isActive"
          ? (e.target as HTMLInputElement).checked
          : name === "sortOrder"
          ? parseInt(value) || 0
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
      submitData.append("subtitle", formData.subtitle);
      submitData.append("discountText", formData.discountText);
      submitData.append("link", formData.link);
      submitData.append("isActive", formData.isActive.toString());
      submitData.append("sortOrder", formData.sortOrder.toString());

      if (imageFile) {
        submitData.append("image", imageFile);
      } else if (editingBanner?.image && !imagePreview) {
        submitData.append("image", editingBanner.image);
      }

      if (editingBanner) {
        await updateBanner(editingBanner._id, submitData);
        toast.success("Cập nhật banner thành công!");
      } else {
        await createBanner(submitData);
        toast.success("Thêm banner thành công!");
      }

      setShowForm(false);
      setEditingBanner(null);
      setFormData({
        title: "",
        subtitle: "",
        discountText: "",
        link: "#",
        isActive: true,
        sortOrder: 0,
      });
      setImageFile(null);
      setImagePreview("");
      fetchBanners();
    } catch (error) {
      console.error("Lỗi", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Có lỗi xảy ra!");
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || "",
      discountText: banner.discountText || "",
      link: banner.link || "#",
      isActive: banner.isActive ?? true,
      sortOrder: banner.sortOrder || 0,
    });
    if (banner.image) {
      setImagePreview(normalizeImageUrl(banner.image));
    }
    setImageFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa banner này?")) return;

    try {
      await deleteBanner(id);
      toast.success("Xóa banner thành công!");
      fetchBanners();
    } catch (error) {
      console.error("Lỗi xóa banner", error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Lỗi khi xóa banner");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBanner(null);
    setFormData({
      title: "",
      subtitle: "",
      discountText: "",
      link: "#",
      isActive: true,
      sortOrder: 0,
    });
    setImageFile(null);
    setImagePreview("");
  };

  if (loading) {
    return <div className="admin-loading">Đang tải...</div>;
  }

  return (
    <div className="admin-banners">
      <div className="admin-header">
        <h2>Quản lý Banner</h2>
        <button
          className="btn-add"
          onClick={() => {
            setShowForm(true);
            setEditingBanner(null);
            setFormData({
              title: "",
              subtitle: "",
              discountText: "",
              link: "#",
              isActive: true,
              sortOrder: 0,
            });
            setImageFile(null);
            setImagePreview("");
          }}
        >
          <i className="fa-solid fa-plus"></i> Thêm Banner
        </button>
      </div>

      {showForm && (
        <div className="admin-form">
          <h3>{editingBanner ? "Chỉnh sửa Banner" : "Thêm Banner mới"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Tiêu đề * <small>(Hiển thị khi hover)</small>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="Ví dụ: Banner khuyến mãi"
              />
            </div>

            <div className="form-group">
              <label>Phụ đề <small>(Subtitle - dòng trên)</small></label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleInputChange}
                placeholder="Ví dụ: Siêu ưu đãi tháng 10 🎉"
              />
            </div>

            <div className="form-group">
              <label>Text giảm giá <small>(Có thể dùng HTML như &lt;b&gt;text&lt;/b&gt;)</small></label>
              <input
                type="text"
                name="discountText"
                value={formData.discountText}
                onChange={handleInputChange}
                placeholder="Ví dụ: Giảm từ <b>10% - 30%</b> cho mọi sản phẩm!"
              />
            </div>

            <div className="form-group">
              <label>Link khi click</label>
              <input
                type="text"
                name="link"
                value={formData.link}
                onChange={handleInputChange}
                placeholder="# hoặc /products"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Thứ tự hiển thị</label>
                <input
                  type="number"
                  name="sortOrder"
                  value={formData.sortOrder}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                  <span>Đang hoạt động</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Hình ảnh *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                required={!editingBanner}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit">
                {editingBanner ? "Cập nhật" : "Thêm"}
              </button>
              <button type="button" className="btn-cancel" onClick={handleCancel}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="banners-list">
        {banners.length === 0 ? (
          <div className="empty-state">Chưa có banner nào</div>
        ) : (
          <div className="banners-grid">
            {banners.map((banner) => (
              <div key={banner._id} className="banner-card">
                <div className="banner-image">
                  <img
                    src={normalizeImageUrl(banner.image)}
                    alt={banner.title}
                  />
                  <div className={`banner-status ${banner.isActive ? "active" : "inactive"}`}>
                    {banner.isActive ? "Đang hoạt động" : "Tạm ẩn"}
                  </div>
                </div>
                <div className="banner-info">
                  <h4>{banner.title}</h4>
                  {banner.subtitle && <p className="banner-subtitle">{banner.subtitle}</p>}
                  {banner.discountText && (
                    <p className="banner-discount" dangerouslySetInnerHTML={{ __html: banner.discountText }}></p>
                  )}
                  <div className="banner-meta">
                    <span>Thứ tự: {banner.sortOrder}</span>
                    <span>Link: {banner.link}</span>
                  </div>
                </div>
                <div className="banner-actions">
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(banner)}
                  >
                    <i className="fa-solid fa-edit"></i> Sửa
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(banner._id)}
                  >
                    <i className="fa-solid fa-trash"></i> Ẩn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBanners;

