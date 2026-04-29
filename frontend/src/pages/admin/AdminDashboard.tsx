import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { getToken } from "../../services/authService";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./css/admin-dashboard.css";

interface DashboardStats {
  products: {
    total: number;
    inRange: number;
  };
  users: {
    total: number;
    inRange: number;
    today: number;
  };
  orders: {
    total: number;
    inRange: number;
    today: number;
    byStatus: {
      pending: number;
      processing: number;
      handover_to_carrier: number;
      shipping: number;
      delivered: number;
      received: number;
      cancelled: number;
    };
  };
  revenue: {
    total: number;
    orders: number;
    average: number;
  };
  dailyStats: Array<{
    date: string;
    orders: number;
    revenue: number;
    byStatus: {
      pending: number;
      processing: number;
      handover_to_carrier: number;
      shipping: number;
      delivered: number;
      received: number;
      cancelled: number;
    };
  }>;
  bestSellingProducts: Array<{
    productId: string;
    name: string;
    image: string;
    price: number;
    quantitySold: number;
    revenue: number;
  }>;
}

const STATUS_LABELS: { [key: string]: string } = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  handover_to_carrier: "Đã bàn giao",
  shipping: "Đang giao",
  delivered: "Đã giao",
  received: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const STATUS_COLORS: { [key: string]: string } = {
  pending: "#ffc107",
  processing: "#ffc107",
  handover_to_carrier: "#17a2b8",
  shipping: "#17a2b8",
  delivered: "#28a745",
  received: "#28a745",
  cancelled: "#dc3545",
};

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>("7days");
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    return new Date();
  });
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    return new Date();
  });
  const [selectedQuarter, setSelectedQuarter] = useState<{ year: number; quarter: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
  });
  const [selectedYear, setSelectedYear] = useState<Date | null>(() => {
    return new Date();
  });
  const [startDateRange, setStartDateRange] = useState<Date | null>(null);
  const [endDateRange, setEndDateRange] = useState<Date | null>(null);

  const fetchStats = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const token = getToken();
      const params = new URLSearchParams();
      
      if (timePeriod) {
        let start: Date | null = null;
        let end: Date | null = null;

        if (timePeriod === "day" && selectedDate) {
          start = new Date(selectedDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(selectedDate);
          end.setHours(23, 59, 59, 999);
        } else if (timePeriod === "7days") {
          // 7 ngày gần nhất
          end = new Date();
          end.setHours(23, 59, 59, 999);
          start = new Date(end);
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        } else if (timePeriod === "month" && selectedMonth) {
          const year = selectedMonth.getFullYear();
          const month = selectedMonth.getMonth();
          start = new Date(year, month, 1);
          end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }

        if (start && end) {
          // Format date thành YYYY-MM-DD để tránh timezone issue
          const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };
          params.append("startDate", formatDate(start));
          params.append("endDate", formatDate(end));
        }
      }

      const res = await axios.get(
        `http://localhost:5000/api/dashboard/stats?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.data.success) {
        console.log("Dashboard stats:", res.data.data);
        console.log("Daily stats:", res.data.data.dailyStats);
        setStats(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi lấy thống kê:", error);
      toast.error("Không thể tải thống kê. Vui lòng thử lại.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [timePeriod, selectedDate, selectedMonth, selectedQuarter, selectedYear, startDateRange, endDateRange]);

  useEffect(() => {
    // Chỉ fetch lần đầu khi component mount với filter mặc định 7days
    fetchStats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const handleApplyFilter = () => {
    fetchStats(false); // Không hiển thị loading khi filter
  };

  const handleResetFilter = () => {
    const now = new Date();
    setTimePeriod("7days");
    setSelectedDate(now);
    setSelectedMonth(now);
    setSelectedQuarter({ year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 });
    setSelectedYear(now);
    setStartDateRange(null);
    setEndDateRange(null);
  };

  const getQuarterOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let year = currentYear; year >= currentYear - 2; year--) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        options.push({ year, quarter });
      }
    }
    return options;
  };

  const formatQuarterLabel = (year: number, quarter: number) => {
    return `Q${quarter} ${year}`;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div>Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-error">
        <div>Không thể tải dữ liệu thống kê</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
        </div>
        <div className="date-filter">
          <div className="filter-group">
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="filter-select"
            >
              <option value="day">Theo ngày</option>
              <option value="7days">7 ngày gần nhất</option>
              <option value="month">Theo tháng</option>
            </select>
          </div>
          {timePeriod === "day" && (
            <div className="filter-group">
              <label>Ngày:</label>
              <DatePicker
                selected={selectedDate}
                onChange={(date: Date | null) => setSelectedDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Chọn ngày"
                className="filter-select date-picker-input"
                isClearable
              />
            </div>
          )}
          {timePeriod === "month" && (
            <div className="filter-group">
              <label>Tháng:</label>
              <DatePicker
                selected={selectedMonth}
                onChange={(date: Date | null) => setSelectedMonth(date)}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                placeholderText="Chọn tháng"
                className="filter-select date-picker-input"
                isClearable
              />
            </div>
          )}
          {timePeriod === "quarter" && (
            <div className="filter-group">
              <label>Quý:</label>
              <select
                value={`${selectedQuarter.year}-Q${selectedQuarter.quarter}`}
                onChange={(e) => {
                  const [year, quarter] = e.target.value.split("-Q");
                  setSelectedQuarter({ year: parseInt(year), quarter: parseInt(quarter) });
                }}
                className="filter-select"
              >
                {getQuarterOptions().map((opt) => (
                  <option key={`${opt.year}-Q${opt.quarter}`} value={`${opt.year}-Q${opt.quarter}`}>
                    {formatQuarterLabel(opt.year, opt.quarter)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {timePeriod === "year" && (
            <div className="filter-group">
              <label>Năm:</label>
              <DatePicker
                selected={selectedYear}
                onChange={(date: Date | null) => setSelectedYear(date)}
                dateFormat="yyyy"
                showYearPicker
                placeholderText="Chọn năm"
                className="filter-select date-picker-input"
                isClearable
              />
            </div>
          )}
          {timePeriod === "range" && (
            <>
              <div className="filter-group">
                <label>Từ ngày:</label>
                <DatePicker
                  selected={startDateRange}
                  onChange={(date: Date | null) => setStartDateRange(date)}
                  selectsStart
                  startDate={startDateRange}
                  endDate={endDateRange}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Chọn ngày bắt đầu"
                  className="filter-select date-picker-input"
                  isClearable
                />
              </div>
              <div className="filter-group">
                <label>Đến ngày:</label>
                <DatePicker
                  selected={endDateRange}
                  onChange={(date: Date | null) => setEndDateRange(date)}
                  selectsEnd
                  startDate={startDateRange || undefined}
                  endDate={endDateRange || undefined}
                  minDate={startDateRange || undefined}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Chọn ngày kết thúc"
                  className="filter-select date-picker-input"
                  isClearable
                />
              </div>
            </>
          )}
          <button className="btn-apply" onClick={handleApplyFilter}>
            <i className="fa-solid fa-calendar"></i>
            Áp dụng
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {/* Products Stats */}
        <div className="stat-card">
          <div className="stat-icon products">
            <i className="fa-solid fa-box"></i>
          </div>
          <div className="stat-content">
            <div className="stat-label">Tổng sản phẩm</div>
            <div className="stat-value">{stats.products.total}</div>
          </div>
        </div>

        {/* Orders Stats */}
        <div className="stat-card">
          <div className="stat-icon orders">
            <i className="fa-solid fa-shopping-bag"></i>
          </div>
          <div className="stat-content">
            <div className="stat-label">Tổng đơn hàng</div>
            <div className="stat-value">{stats.orders.total}</div>
          </div>
        </div>

        {/* Users Stats */}
        <div className="stat-card">
          <div className="stat-icon users">
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="stat-content">
            <div className="stat-label">Tổng người dùng</div>
            <div className="stat-value">{stats.users.total}</div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="stat-card">
          <div className="stat-icon revenue">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="stat-content">
            <div className="stat-label">Tổng doanh thu</div>
            <div className="stat-value">{formatCurrency(stats.revenue.total)}</div>
          </div>
        </div>
      </div>

      {/* Order Statistics Section */}
      <div className="dashboard-section">
        <h3>Thống kê đơn hàng</h3>
        
        {/* Revenue by Day Line Chart */}
        <div className="chart-wrapper">
          <h4>Doanh thu theo ngày</h4>
          <div className="line-chart-container">
            <div className="line-chart">
              <svg className="line-chart-svg" viewBox="0 0 1000 300" preserveAspectRatio="none">
                {stats.dailyStats.length > 0 && (
                  <>
                    {stats.dailyStats.length > 1 && (
                      <polyline
                        className="line-chart-path"
                        points={stats.dailyStats.map((day, index) => {
                          const maxRevenue = Math.max(
                            ...stats.dailyStats.map((d) => d.revenue),
                            1
                          );
                          // Tính x để căn chỉnh với labels (labels được chia đều bằng flex)
                          // Điểm đầu ở 0, điểm cuối ở 1000, các điểm giữa chia đều
                          const x = stats.dailyStats.length === 1 
                            ? 500 
                            : (index / (stats.dailyStats.length - 1)) * 1000;
                          const y = 300 - (day.revenue / maxRevenue) * 280;
                          return `${x},${y}`;
                        }).join(" ")}
                        fill="none"
                        stroke="#007bff"
                        strokeWidth="2"
                      />
                    )}
                    {stats.dailyStats.map((day, index) => {
                      const maxRevenue = Math.max(
                        ...stats.dailyStats.map((d) => d.revenue),
                        1
                      );
                      // Tính x để căn chỉnh với labels
                      const x = stats.dailyStats.length === 1 
                        ? 500 
                        : (index / (stats.dailyStats.length - 1)) * 1000;
                      const y = 300 - (day.revenue / maxRevenue) * 280;
                      return (
                        <g key={index}>
                          <title>{formatCurrency(day.revenue)}</title>
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#007bff"
                            className="line-chart-dot"
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
              <div className="line-chart-labels">
                {stats.dailyStats.map((day, index) => (
                  <div key={index} className="line-chart-label" style={{ flex: stats.dailyStats.length === 1 ? '1' : '0 0 auto' }}>
                    {formatDate(day.date)}
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "#007bff" }}></span>
                Doanh thu
              </span>
            </div>
          </div>
        </div>

        {/* Orders by Status Bar Chart */}
        <div className="chart-wrapper">
          <h4>Số đơn hàng theo trạng thái</h4>
          <div className="bar-chart-container">
            <div className="bar-chart">
              {stats.dailyStats.length > 0 ? (
                stats.dailyStats.map((day, index) => {
                  const maxOrders = Math.max(
                    ...stats.dailyStats.map((d) => d.orders),
                    1
                  );
                  const barHeight = (day.orders / maxOrders) * 100;
                  
                  const statusOrder = ["received", "delivered", "processing", "pending"] as const;
                  const statusCounts = statusOrder.map(status => ({
                    status,
                    count: (day.byStatus[status as keyof typeof day.byStatus] || 0) as number,
                  })).filter(item => item.count > 0);

                  return (
                    <div key={index} className="bar-chart-item">
                      <div className="bar-chart-bars">
                        {statusCounts.length > 0 ? (
                          statusCounts.map((item, idx) => {
                            const segmentHeight = day.orders > 0 ? (item.count / day.orders) * barHeight : 0;
                            return (
                              <div
                                key={idx}
                                className="bar-chart-segment"
                                style={{
                                  height: `${segmentHeight}%`,
                                  backgroundColor: STATUS_COLORS[item.status] || "#6c757d",
                                }}
                                title={`${STATUS_LABELS[item.status]}: ${item.count}`}
                              ></div>
                            );
                          })
                        ) : (
                          <div
                            className="bar-chart-segment"
                            style={{
                              height: "0%",
                              backgroundColor: "#e9ecef",
                            }}
                            title="Không có đơn hàng"
                          ></div>
                        )}
                      </div>
                      <div className="bar-chart-label">{formatDate(day.date)}</div>
                      <div className="bar-chart-value">{day.orders}</div>
                    </div>
                  );
                })
              ) : (
                <div className="no-chart-data">Không có dữ liệu</div>
              )}
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "#28a745" }}></span>
                Đã hoàn thành
              </span>
              <span className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "#ffc107" }}></span>
                Đang xử lý
              </span>
              <span className="legend-item">
                <span className="legend-color" style={{ backgroundColor: "#dc3545" }}></span>
                Chờ xử lý
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
