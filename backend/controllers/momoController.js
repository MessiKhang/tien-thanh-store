const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../models/Order");

const MOMO_CONFIG = {
    endpoint:    process.env.MOMO_ENDPOINT    || "https://test-payment.momo.vn/v2/gateway/api/create",
    partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
    accessKey:   process.env.MOMO_ACCESS_KEY   || "F8BBA842ECF85",
    secretKey:   process.env.MOMO_SECRET_KEY   || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    redirectUrl: process.env.MOMO_REDIRECT_URL || "http://localhost:5000/api/orders/momo/callback",
    ipnUrl:      process.env.MOMO_IPN_URL      || "http://localhost:5000/api/momo/ipn",
    frontendUrl: process.env.FRONTEND_URL      || "http://localhost:3000",
};

const createSignature = (rawHash) =>
    crypto.createHmac("sha256", MOMO_CONFIG.secretKey).update(rawHash).digest("hex");

// ===== CREATE PAYMENT URL =====
const createMomoPayment = async (req, res) => {
    try {
        const { total_momo, orderData } = req.body;
        const amount = Number(total_momo);

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: `Số tiền không hợp lệ: ${total_momo}` });
        }
        if (!orderData?.userId) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin đơn hàng." });
        }

        const requestId  = Date.now().toString();
        const momoOrderId = `TEMP_${requestId}`;
        const orderInfo  = "Thanh toán qua ATM MoMo";
        const requestType = "payWithATM";

        // Store full orderData in extraData (base64) — MoMo passes it back in callback & IPN
        const extraData = Buffer.from(JSON.stringify(orderData)).toString("base64");

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

        const signature = createSignature(rawHash);

        const response = await axios.post(MOMO_CONFIG.endpoint, {
            partnerCode: MOMO_CONFIG.partnerCode,
            partnerName: "Test",
            storeId:     "MomoTestStore",
            requestId,
            amount,
            orderId:     momoOrderId,
            orderInfo,
            redirectUrl: MOMO_CONFIG.redirectUrl,
            ipnUrl:      MOMO_CONFIG.ipnUrl,
            lang:        "vi",
            extraData,
            requestType,
            signature,
        }, { headers: { "Content-Type": "application/json" } });

        if (response.data.payUrl) {
            return res.json({ success: true, payUrl: response.data.payUrl });
        }

        return res.status(400).json({
            success: false,
            message: response.data.message || "Không thể tạo link thanh toán MoMo",
        });
    } catch (error) {
        console.error("createMomoPayment error:", error);
        return res.status(500).json({
            success: false,
            message: error?.response?.data?.message || "Lỗi khi tạo thanh toán MoMo",
        });
    }
};

// ── Shared: verify MoMo callback signature ────────────────────────────────
const verifyMomoSignature = ({ partnerCode, orderId, requestId, amount, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature }) => {
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
    return createSignature(rawHash) === signature;
};

// ── Shared: create order + clear cart from MoMo data ─────────────────────
const processSuccessfulPayment = async (extraData, transId, label) => {
    // FIX: use createOrderFromPayment (not the old createOrderFromMomo)
    const { createOrderFromPayment } = require("./orderController");

    let orderData;
    try {
        orderData = JSON.parse(Buffer.from(extraData, "base64").toString("utf-8"));
    } catch (e) {
        console.error(`[${label}] Failed to parse extraData:`, e.message);
        return null;
    }

    // Check idempotency — don't create duplicate order if already processed
    const existing = await Order.findOne({
        "statusHistory.note": { $regex: String(transId), $options: "i" },
    });
    if (existing) {
        console.log(`[${label}] Order ${existing.code} already exists for transId ${transId}`);
        return existing;
    }

    // FIX: createOrderFromPayment handles both order creation, stock decrement AND cart clearing
    const order = await createOrderFromPayment(orderData, transId, "momo");

    if (order) {
        console.log(`[${label}] ✅ Order ${order.code} created for transId ${transId}`);
    } else {
        console.error(`[${label}] ❌ createOrderFromPayment returned null for transId ${transId}`);
    }

    return order;
};

// ===== REDIRECT CALLBACK FROM MOMO (browser) =====
const momoCallback = async (req, res) => {
    try {
        const params = req.query;
        const { resultCode, message, transId, extraData } = params;
        const isSuccess = String(resultCode) === "0";

        if (!isSuccess) {
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent(message || "Thanh toán thất bại")}`,
            );
        }

        if (!verifyMomoSignature(params)) {
            console.error("[MoMo Callback] Signature verification failed");
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Xác thực chữ ký thất bại")}`,
            );
        }

        // FIX: use shared helper — no duplicate cart clearing here
        const order = await processSuccessfulPayment(extraData, transId, "MoMo Callback");

        if (!order) {
            return res.redirect(
                `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Không thể tạo đơn hàng")}`,
            );
        }

        return res.redirect(
            `${MOMO_CONFIG.frontendUrl}/order-success?orderId=${order._id}&transId=${transId}`,
        );
    } catch (error) {
        console.error("momoCallback error:", error);
        return res.redirect(
            `${MOMO_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Lỗi xử lý callback MoMo")}`,
        );
    }
};

// ===== IPN (server-to-server from MoMo) =====
const momoIPN = async (req, res) => {
    try {
        const params = req.body;
        const { resultCode, transId, extraData } = params;

        if (!verifyMomoSignature(params)) {
            console.error("[MoMo IPN] Signature verification failed");
            return res.status(400).json({ resultCode: -1, message: "Invalid signature" });
        }

        if (String(resultCode) === "0") {
            // FIX: use shared helper — handles idempotency + cart clearing
            await processSuccessfulPayment(extraData, transId, "MoMo IPN");
        }

        // Always return success to MoMo so it stops retrying
        return res.json({ resultCode: 0, message: "Success" });
    } catch (error) {
        console.error("momoIPN error:", error);
        return res.status(500).json({ resultCode: -1, message: "Internal error" });
    }
};

module.exports = { createMomoPayment, momoCallback, momoIPN };