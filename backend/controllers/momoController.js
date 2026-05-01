const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");

// Cấu hình MOMO (nên lưu vào .env)
const MOMO_CONFIG = {
    endpoint:
        process.env.MOMO_ENDPOINT ||
        "https://test-payment.momo.vn/v2/gateway/api/create",
    partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
    accessKey: process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85",
    secretKey:
        process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    redirectUrl:
        process.env.MOMO_REDIRECT_URL ||
        "http://localhost:5000/api/orders/momo/callback",
    ipnUrl: process.env.MOMO_IPN_URL || "http://localhost:5000/api/momo/ipn",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};

// Hàm tạo signature
const createSignature = (rawHash, secretKey) => {
    return crypto.createHmac("sha256", secretKey).update(rawHash).digest("hex");
};

// Hàm gửi POST request
const execPostRequest = async (url, data) => {
    try {
        const response = await axios.post(url, data, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        return JSON.stringify(response.data);
    } catch (error) {
        console.error("execPostRequest error:", error);
        throw error;
    }
};

// Tìm order bằng code hoặc _id (nếu hợp lệ)
const findOrderByIdOrCode = async (id) => {
    if (!id) return null;
    const queries = [{ code: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
        queries.push({ _id: id });
    }
    return Order.findOne({ $or: queries });
};

// ===== TẠO PAYMENT URL =====
const createMomoPayment = async (req, res) => {
    try {
        const { total_momo, orderData } = req.body;

        // Validate và chuyển đổi total_momo thành số
        const amount = Number(total_momo);

        if (!total_momo || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: `Số tiền thanh toán không hợp lệ. Giá trị nhận được: ${total_momo}`,
            });
        }

        if (!orderData || !orderData.userId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin đơn hàng.",
            });
        }

        const orderInfo = "Thanh toán qua ATM MoMo";
        const requestId = Date.now().toString();
        const requestType = "payWithATM";

        // Lưu thông tin đơn hàng vào extraData (encode base64)
        const extraData = Buffer.from(JSON.stringify(orderData)).toString(
            "base64",
        );

        // orderId tạm thời (chỉ để MoMo tracking)
        const momoOrderId = `TEMP_${requestId}`;

        // Tạo rawHash để ký
        const rawHash =
            `accessKey=${MOMO_CONFIG.accessKey}` +
            `&amount=${amount}` +
            `&extraData=${extraData}` +
            `&ipnUrl=${MOMO_CONFIG.ipnUrl}` +
            `&orderId=${momoOrderId}` +
            `&orderInfo=${orderInfo}` +
            `&partnerCode=${MOMO_CONFIG.partnerCode}` +
            `&redirectUrl=${MOMO_CONFIG.redirectUrl}` +
            `&requestId=${requestId}` +
            `&requestType=${requestType}`;

        // Tạo signature
        const signature = createSignature(rawHash, MOMO_CONFIG.secretKey);

        // Tạo data để gửi
        const data = {
            partnerCode: MOMO_CONFIG.partnerCode,
            partnerName: "Test",
            storeId: "MomoTestStore",
            requestId: requestId,
            amount: amount,
            orderId: momoOrderId,
            orderInfo: orderInfo,
            redirectUrl: MOMO_CONFIG.redirectUrl,
            ipnUrl: MOMO_CONFIG.ipnUrl,
            lang: "vi",
            extraData: extraData,
            requestType: requestType,
            signature: signature,
        };

        // Gửi request đến MOMO
        const result = await execPostRequest(MOMO_CONFIG.endpoint, data);
        const jsonResult = JSON.parse(result);

        if (jsonResult.payUrl) {
            return res.json({
                success: true,
                payUrl: jsonResult.payUrl,
            });
        } else {
            const msg =
                jsonResult.message || "Không thể tạo link thanh toán MOMO";
            return res.status(400).json({
                success: false,
                message: msg,
            });
        }
    } catch (error) {
        console.error("createMomoPayment error:", error);
        const apiMessage =
            error?.response?.data?.message ||
            error?.response?.data?.Message ||
            "Lỗi khi tạo thanh toán MOMO";
        return res.status(500).json({
            success: false,
            message: apiMessage,
            error: error.message,
        });
    }
};

// ===== XỬ LÝ CALLBACK TỪ MOMO =====
const momoCallback = async (req, res) => {
    try {
        const {
            partnerCode,
            orderId,
            requestId,
            amount,
            orderInfo,
            orderType,
            transId,
            resultCode,
            message,
            payType,
            responseTime,
            extraData,
            signature,
        } = req.query;

        const isSuccess = resultCode === "0" || resultCode === 0;

        // Nếu người dùng hủy / thanh toán thất bại → Redirect về checkout
        if (!isSuccess) {
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent(message || "Thanh toán thất bại")}`,
            );
        }

        // Tạo rawHash để verify signature
        const rawHash =
            `accessKey=${MOMO_CONFIG.accessKey}` +
            `&amount=${amount}` +
            `&extraData=${extraData || ""}` +
            `&message=${message}` +
            `&orderId=${orderId}` +
            `&orderInfo=${orderInfo}` +
            `&orderType=${orderType}` +
            `&partnerCode=${partnerCode}` +
            `&payType=${payType}` +
            `&requestId=${requestId}` +
            `&responseTime=${responseTime}` +
            `&resultCode=${resultCode}` +
            `&transId=${transId}`;

        // Verify signature
        const verifySignature = createSignature(rawHash, MOMO_CONFIG.secretKey);

        if (verifySignature !== signature) {
            console.error("MOMO signature verification failed");
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Xác thực chữ ký thất bại")}`,
            );
        }

        // Parse thông tin đơn hàng từ extraData
        let orderData;
        try {
            orderData = JSON.parse(
                Buffer.from(extraData, "base64").toString("utf-8"),
            );
        } catch (parseError) {
            console.error("Failed to parse extraData:", parseError);
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Lỗi xử lý thông tin đơn hàng")}`,
            );
        }

        // Tạo đơn hàng mới (gọi hàm createOrder từ orderController)
        const Cart = require("../models/Cart");
        const { createOrderFromMomo } = require("./orderController");

        const order = await createOrderFromMomo(orderData, transId);

        if (!order) {
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Không thể tạo đơn hàng")}`,
            );
        }

        // Xóa giỏ hàng sau khi đặt hàng thành công
        await Cart.updateOne(
            { userId: orderData.userId },
            { $set: { items: [] } },
        );

        // Redirect về trang order success với _id
        return res.redirect(
            `${MOMO_CONFIG.frontendUrl}/order-success?orderId=${order._id}&transId=${transId}`,
        );
    } catch (error) {
        console.error("momoCallback error:", error);
        return res.redirect(
            `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Lỗi xử lý callback từ MOMO")}`,
        );
    }
};

// ===== IPN (Instant Payment Notification) =====
const momoIPN = async (req, res) => {
    try {
        const {
            partnerCode,
            orderId,
            requestId,
            amount,
            orderInfo,
            orderType,
            transId,
            resultCode,
            message,
            payType,
            responseTime,
            extraData,
            signature,
        } = req.body;

        // Tạo rawHash để verify signature
        const rawHash =
            `accessKey=${MOMO_CONFIG.accessKey}` +
            `&amount=${amount}` +
            `&extraData=${extraData || ""}` +
            `&message=${message}` +
            `&orderId=${orderId}` +
            `&orderInfo=${orderInfo}` +
            `&orderType=${orderType}` +
            `&partnerCode=${partnerCode}` +
            `&payType=${payType}` +
            `&requestId=${requestId}` +
            `&responseTime=${responseTime}` +
            `&resultCode=${resultCode}` +
            `&transId=${transId}`;

        // Verify signature
        const verifySignature = createSignature(rawHash, MOMO_CONFIG.secretKey);

        if (verifySignature !== signature) {
            return res.status(400).json({
                resultCode: -1,
                message: "Invalid signature",
            });
        }

        // Xử lý thanh toán thành công
        if (String(resultCode) === "0") {
            // Kiểm tra xem đơn đã tồn tại chưa (có thể callback đã tạo rồi)
            // Parse orderId để lấy requestId và check database
            if (orderId.startsWith("TEMP_")) {
                const requestId = orderId.replace("TEMP_", "");

                // Tìm đơn theo transId hoặc requestId trong statusHistory
                const existingOrder = await Order.findOne({
                    "statusHistory.note": { $regex: transId },
                });

                if (existingOrder) {
                    console.log(
                        `[IPN] Đơn ${existingOrder.code} đã tồn tại từ callback`,
                    );
                    return res.json({
                        resultCode: 0,
                        message: "Success",
                    });
                }

                // Nếu chưa tồn tại, parse extraData và tạo đơn mới
                try {
                    const orderData = JSON.parse(
                        Buffer.from(extraData, "base64").toString("utf-8"),
                    );
                    const Cart = require("../models/Cart");
                    const {
                        createOrderFromMomo,
                    } = require("./orderController");

                    const order = await createOrderFromMomo(orderData, transId);

                    if (order) {
                        // Xóa giỏ hàng
                        await Cart.updateOne(
                            { userId: orderData.userId },
                            { $set: { items: [] } },
                        );
                        console.log(
                            `[IPN] Tạo đơn ${order.code} thành công từ IPN`,
                        );
                    }
                } catch (parseError) {
                    console.error(
                        "[IPN] Failed to parse extraData:",
                        parseError,
                    );
                }
            }
        }

        // Trả về response cho MOMO
        return res.json({
            resultCode: 0,
            message: "Success",
        });
    } catch (error) {
        console.error("momoIPN error:", error);
        return res.status(500).json({
            resultCode: -1,
            message: "Internal error",
        });
    }
};

module.exports = {
    createMomoPayment,
    momoCallback,
    momoIPN,
};
