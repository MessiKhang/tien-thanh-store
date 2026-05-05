const crypto = require("crypto");
const axios = require("axios");
const qs = require("qs");
const https = require("https");
const Order = require("../models/Order");
const Cart = require("../models/Cart");

const ZALOPAY_CONFIG = {
    appId: Number(process.env.ZALOPAY_APP_ID || "2553"),
    key1: process.env.ZALOPAY_KEY1 || "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
    key2: process.env.ZALOPAY_KEY2 || "kLtgPl8HHhfvMuDHPwKfgfsZ4Gu8VMBa",
    endpoint:
        process.env.ZALOPAY_ENDPOINT ||
        "https://sb-openapi.zalopay.vn/v2/create",
    callbackUrl:
        process.env.ZALOPAY_CALLBACK_URL ||
        "http://localhost:5000/api/zalopay/callback",
    redirectUrl:
        process.env.ZALOPAY_REDIRECT_URL ||
        "http://localhost:5000/api/zalopay/redirect",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};

// FIX: Store orderData in memory keyed by appTransId.
// This keeps embed_data small (only the key), avoiding ZaloPay's -401 size error.
// For production, replace with Redis or a DB-backed temp store.
const pendingOrders = new Map();

// ===== CREATE PAYMENT URL =====
const createZaloPayPayment = async (req, res) => {
    try {
        const { total_zalopay, orderData } = req.body;
        const amount = Number(total_zalopay);

        if (!total_zalopay || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: `Số tiền không hợp lệ: ${total_zalopay}`,
            });
        }

        if (!orderData || !orderData.userId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin đơn hàng.",
            });
        }

        const transID = Math.floor(Math.random() * 1000000);
        // FIX: ZaloPay requires yyMMdd (2-digit year) — NOT yyyyMMdd
        const _now = new Date();
        const _yy = String(_now.getFullYear()).slice(-2);
        const _mm = String(_now.getMonth() + 1).padStart(2, "0");
        const _dd = String(_now.getDate()).padStart(2, "0");
        const appTransId = `${_yy}${_mm}${_dd}_${transID}`;
        const appTime = Date.now();
        const appUser = String(orderData.userId);

        // FIX: Only put the lookup key in embed_data — NOT the full orderData.
        // ZaloPay sandbox rejects requests where embed_data is too large (-401).
        const embedData = JSON.stringify({
            redirecturl: ZALOPAY_CONFIG.redirectUrl,
            orderKey: appTransId, // backend redirect handler creates order if callback missed
        });

        // Strip image URLs from items to keep the item payload small
        const items = JSON.stringify(
            (orderData.items || []).map((item) => ({
                itemid: String(item.productId),
                itemname: String(item.name || "item").substring(0, 64),
                itemprice: Number(item.price) || 0,
                itemquantity: Number(item.quantity) || 1,
            })),
        );

        // MAC = HMAC-SHA256 of: appId|appTransId|appUser|amount|appTime|embedData|items
        const rawHash = [
            ZALOPAY_CONFIG.appId,
            appTransId,
            appUser,
            amount,
            appTime,
            embedData,
            items,
        ].join("|");

        const mac = crypto
            .createHmac("sha256", ZALOPAY_CONFIG.key1)
            .update(rawHash)
            .digest("hex");

        const postData = {
            app_id: ZALOPAY_CONFIG.appId,
            app_trans_id: appTransId,
            app_user: appUser,
            app_time: appTime,
            item: items,
            embed_data: embedData,
            amount: amount,
            description: `Thanh toan don hang #${appTransId}`,
            callback_url: ZALOPAY_CONFIG.callbackUrl,
            mac: mac,
        };

        console.log("[ZaloPay] rawHash:", rawHash);
        console.log("[ZaloPay] postData:", {
            ...postData,
            embed_data: "(trimmed for log)",
        });

        const response = await axios.post(
            ZALOPAY_CONFIG.endpoint,
            qs.stringify(postData),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                httpsAgent: new https.Agent({
                    keepAlive: true,
                    rejectUnauthorized: false,
                }),
                timeout: 15000,
            },
        );

        console.log("[ZaloPay] Response:", response.data);

        if (response.data.return_code === 1) {
            // Cache orderData in memory (fast path)
            pendingOrders.set(appTransId, {
                orderData,
                createdAt: Date.now(),
            });

            // orderData is cached in-memory only (pendingOrders Map).
            // The Map survives the typical request lifecycle.
            // If the server restarts between create and callback, the payment
            // will fail gracefully and the user can retry.

            // Clean up stale entries older than 30 minutes
            for (const [key, val] of pendingOrders) {
                if (Date.now() - val.createdAt > 30 * 60 * 1000) {
                    pendingOrders.delete(key);
                }
            }

            return res.json({
                success: true,
                payUrl: response.data.order_url,
                appTransId,
            });
        }

        return res.status(400).json({
            success: false,
            message:
                response.data.return_message ||
                "Không thể tạo link thanh toán ZaloPay",
            detail: response.data.sub_return_message,
        });
    } catch (error) {
        console.error(
            "[ZaloPay] createZaloPayPayment error:",
            error?.response?.data || error.message,
        );
        return res.status(500).json({
            success: false,
            message: "Lỗi khi tạo thanh toán ZaloPay",
            error: error.message,
        });
    }
};

// ===== CALLBACK FROM ZALOPAY =====
const zaloPayCallback = async (req, res) => {
    const result = {};
    try {
        const dataStr = req.body.data;
        const reqMac = req.body.mac;

        console.log(
            "[ZaloPay Callback] Received. dataStr:",
            dataStr ? dataStr.substring(0, 120) + "..." : "EMPTY",
        );
        console.log("[ZaloPay Callback] reqMac:", reqMac);
        console.log("[ZaloPay Callback] pendingOrders keys:", [
            ...pendingOrders.keys(),
        ]);

        if (!dataStr || !reqMac) {
            console.error(
                "[ZaloPay Callback] Missing data or mac in request body",
            );
            result.return_code = 0;
            result.return_message = "Missing data or mac";
            return res.json(result);
        }

        // Verify MAC with key2
        const mac = crypto
            .createHmac("sha256", ZALOPAY_CONFIG.key2)
            .update(dataStr)
            .digest("hex");

        console.log("[ZaloPay Callback] computed mac:", mac);
        console.log("[ZaloPay Callback] mac match:", reqMac === mac);

        if (reqMac !== mac) {
            console.error(
                "[ZaloPay Callback] MAC mismatch — reqMac:",
                reqMac,
                "computed:",
                mac,
            );
            result.return_code = -1;
            result.return_message = "MAC không hợp lệ";
            return res.json(result);
        }

        const dataJson = JSON.parse(dataStr);
        const embedData = JSON.parse(dataJson.embed_data);
        const orderKey = embedData.orderKey;
        const transId = dataJson.zp_trans_id?.toString();

        console.log(
            "[ZaloPay Callback] orderKey:",
            orderKey,
            "transId:",
            transId,
        );

        // Look up the full orderData from server-side cache
        const cached = pendingOrders.get(orderKey);
        if (!cached) {
            console.error(
                `[ZaloPay Callback] No pending order found for key: ${orderKey}`,
            );
            console.error(
                `[ZaloPay Callback] Available keys: ${[...pendingOrders.keys()].join(", ") || "none"}`,
            );
            // Return 1 anyway so ZaloPay stops retrying — order may have been created already
            result.return_code = 1;
            result.return_message = "Already processed or not found";
            return res.json(result);
        }

        const { orderData } = cached;
        const { createOrderFromPayment } = require("./orderController");
        const order = await createOrderFromPayment(
            orderData,
            transId,
            "zalopay",
        );

        if (order) {
            pendingOrders.delete(orderKey);
            console.log(
                `[ZaloPay Callback] ✅ Order ${order.code} created. Cart cleared inside createOrderFromPayment.`,
            );
        } else {
            console.error(
                `[ZaloPay Callback] createOrderFromPayment returned null for key: ${orderKey}`,
            );
        }

        result.return_code = 1;
        result.return_message = "Success";
    } catch (error) {
        console.error("[ZaloPay Callback] error:", error);
        result.return_code = 0;
        result.return_message = error.message;
    }

    return res.json(result);
};

// ===== REDIRECT AFTER PAYMENT =====
const zaloPayRedirect = async (req, res) => {
    try {
        const { status, apptransid } = req.query;

        if (status !== "1") {
            return res.redirect(
                `${ZALOPAY_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Thanh toán ZaloPay thất bại")}`,
            );
        }

        // Try to find order by appTransId in statusHistory note
        const findOrder = async () =>
            Order.findOne({
                "statusHistory.note": { $regex: apptransid, $options: "i" },
            });

        let order = await findOrder();

        // Callback may not have completed yet — retry up to 3x with 1.5s gap
        for (let i = 0; i < 3 && !order; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            order = await findOrder();
        }

        if (order) {
            return res.redirect(
                `${ZALOPAY_CONFIG.frontendUrl}/order-success?orderId=${order._id}&transId=${apptransid}`,
            );
        }

        // FALLBACK: callback never arrived but payment succeeded (status=1).
        // Try to create the order directly from pendingOrders cache.
        console.warn(
            `[ZaloPay Redirect] Callback not received for ${apptransid} — attempting fallback order creation`,
        );
        const cached = pendingOrders.get(apptransid);
        if (cached) {
            const { createOrderFromPayment } = require("./orderController");
            const fallbackOrder = await createOrderFromPayment(
                cached.orderData,
                apptransid,
                "zalopay",
            );
            if (fallbackOrder) {
                pendingOrders.delete(apptransid);
                console.log(
                    `[ZaloPay Redirect] ✅ Fallback order ${fallbackOrder.code} created`,
                );
                return res.redirect(
                    `${ZALOPAY_CONFIG.frontendUrl}/order-success?orderId=${fallbackOrder._id}&transId=${apptransid}`,
                );
            }
        }

        return res.redirect(
            `${ZALOPAY_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Không tìm thấy đơn hàng. Vui lòng kiểm tra lịch sử đơn hàng.")}`,
        );
    } catch (error) {
        console.error("[ZaloPay] zaloPayRedirect error:", error);
        return res.redirect(
            `${ZALOPAY_CONFIG.frontendUrl}/checkout?error=${encodeURIComponent("Lỗi xử lý ZaloPay")}`,
        );
    }
};

module.exports = {
    createZaloPayPayment,
    zaloPayCallback,
    zaloPayRedirect,
};
