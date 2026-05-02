// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const Product = require("./models/Product");
const cartRoutes = require("./routes/cartRoutes");
const mongoose = require("mongoose");

const app = express();

// Bật CORS trước khi định nghĩa route để tránh bị lỗi
app.use(
    cors({
        origin: true, // tự động chấp nhận origin của request đến (React 3000, 3001,...)
        credentials: true,
    }),
);

app.use(express.json());

// Middleware logging API requests (chỉ log trong development)
if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
        const start = Date.now();
        const timestamp = new Date().toLocaleString("vi-VN");

        // Log request
        console.log(
            `\n[${timestamp}] ${req.method} ${req.originalUrl || req.path}`,
        );

        // Kiểm tra query parameters
        if (
            req.query &&
            typeof req.query === "object" &&
            Object.keys(req.query).length > 0
        ) {
            console.log(`  📋 Query:`, req.query);
        }

        // Kiểm tra body (chỉ log cho POST, PUT, PATCH, DELETE)
        if (
            req.body &&
            typeof req.body === "object" &&
            Object.keys(req.body).length > 0 &&
            req.method !== "GET"
        ) {
            // Ẩn password trong log
            const logBody = { ...req.body };
            if (logBody.password) logBody.password = "***";
            if (logBody.currentPassword) logBody.currentPassword = "***";
            if (logBody.newPassword) logBody.newPassword = "***";
            console.log(`  📦 Body:`, JSON.stringify(logBody, null, 2));
        }

        // Log response
        const originalJson = res.json;
        const originalSend = res.send;

        res.json = function (data) {
            const duration = Date.now() - start;
            const statusColor =
                res.statusCode >= 400
                    ? "❌"
                    : res.statusCode >= 300
                      ? "⚠️"
                      : "✅";
            console.log(`  ${statusColor} ${res.statusCode} - ${duration}ms`);
            if (res.statusCode >= 400) {
                const errorMsg =
                    data?.message ||
                    data?.error ||
                    data?.errors ||
                    "Unknown error";
                console.log(`  ⚠️  Error:`, errorMsg);
            } else if (data?.success && data?.message) {
                console.log(`  💬 Message:`, data.message);
            }
            return originalJson.call(this, data);
        };

        res.send = function (data) {
            const duration = Date.now() - start;
            const statusColor =
                res.statusCode >= 400
                    ? "❌"
                    : res.statusCode >= 300
                      ? "⚠️"
                      : "✅";
            console.log(`  ${statusColor} ${res.statusCode} - ${duration}ms`);
            return originalSend.call(this, data);
        };

        next();
    });
}

app.use("/img", express.static(path.join(__dirname, "public", "img")));

// Kết nối tới route productRoutes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/cart", cartRoutes);
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/brands", require("./routes/brandRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/news", require("./routes/newsRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/banners", require("./routes/bannerRoutes"));

// API chính lấy sản phẩm (Lấy cả home và product chung)
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find().lean();

        // Tự động thêm đường dẫn đầy đủ cho ảnh
        const productsWithFullImage = products.map((p) => ({
            ...p,
            image: p.image?.startsWith("http")
                ? p.image
                : `http://localhost:5000/${p.image}`,
        }));

        res.json(productsWithFullImage);
    } catch (err) {
        console.error("❌ Lỗi API /api/products:", err);
        res.status(500).json({ error: "Lỗi server", details: err.message });
    }
});

// ✅ Khởi động server
const startServer = async () => {
    try {
        await connectDB();
        console.log("✅ MongoDB kết nối thành công");

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server chạy tại: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error(" Lỗi khởi động server:", err);
        process.exit(1);
    }
};

startServer();
