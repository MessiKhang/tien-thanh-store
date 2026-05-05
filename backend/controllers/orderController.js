const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const { incrementUsedCount } = require("./couponController");

const STATUS_LABELS = {
    awaiting_payment: "Chờ thanh toán",
    pending: "Chờ xác nhận",
    processing: "Đang xử lý",
    handover_to_carrier: "Đã bàn giao cho đơn vị vận chuyển",
    shipping: "Đang giao hàng",
    delivered: "Đã giao hàng",
    received: "Khách đã nhận",
    cancelled: "Đã huỷ",
};

const ONLINE_PAYMENT_METHODS = ["momo", "zalopay", "payoo"];

const toNumber = (value) => {
    if (!value && value !== 0) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || 0;
    if (typeof value === "object" && value.$numberDecimal) {
        return parseFloat(value.$numberDecimal) || 0;
    }
    return 0;
};

const buildShippingPayload = (raw = {}) => ({
    fullName: raw.fullName?.trim() || "",
    phone: raw.phone?.trim() || "",
    email: raw.email?.trim() || "",
    address: raw.address?.trim() || "",
    city: raw.city?.trim() || "",
    district: raw.district?.trim() || "",
    ward: raw.ward?.trim() || "",
    note: raw.note?.trim() || "",
});

// ── Shared: decrement stock after order confirmed ──────────────────────────
const decrementStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const colorName = item.selectedColor || "";

        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } }, { new: true });

        if (product.colorStocks?.length > 0) {
            const idx = product.colorStocks.findIndex((cs) => cs.name === colorName);
            if (idx !== -1) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { [`colorStocks.${idx}.stock`]: -item.quantity } }, { new: true });
            }
        }

        const updated = await Product.findById(item.productId);
        if (updated) {
            if (updated.stock <= 0) await Product.findByIdAndUpdate(item.productId, { inStock: false });
            if (updated.colorStocks?.length > 0 && updated.colorStocks.every((cs) => cs.stock <= 0)) {
                await Product.findByIdAndUpdate(item.productId, { inStock: false });
            }
        }
    }
};

// ── Shared: restore stock on cancel ───────────────────────────────────────
const restoreStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.productId);
        const colorName = item.selectedColor || "";

        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { new: true });

        if (product?.colorStocks?.length > 0) {
            const idx = product.colorStocks.findIndex((cs) => cs.name === colorName);
            if (idx !== -1) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { [`colorStocks.${idx}.stock`]: item.quantity } }, { new: true });
            }
        }

        const updated = await Product.findById(item.productId);
        if (updated?.stock > 0) await Product.findByIdAndUpdate(item.productId, { inStock: true });
    }
};

// ── Shared: retry wrapper for Order.create ────────────────────────────────
const createOrderWithRetry = async (payload, maxAttempts = 3) => {
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            return await Order.create(payload);
        } catch (err) {
            if (err.code === 11000 || err.codeName === "DuplicateKey") {
                attempts++;
                if (attempts >= maxAttempts) throw new Error("Không thể tạo mã đơn hàng duy nhất. Vui lòng thử lại.");
                await new Promise((r) => setTimeout(r, 200));
            } else {
                throw err;
            }
        }
    }
};

// ===== CREATE ORDER (COD only) =====
const createOrder = async (req, res) => {
    try {
        const authUserId = req.user?._id?.toString();
        const { userId: bodyUserId, shippingInfo, paymentMethod = "cod", shippingFee = 0, discount = 0, couponCode } = req.body;
        const userId = authUserId || bodyUserId;

        if (!userId) return res.status(400).json({ success: false, message: "Thiếu thông tin user. Vui lòng đăng nhập lại." });

        // FIX 1: Explicit COD-only guard
        if (ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: "Thanh toán online phải thực hiện qua cổng thanh toán." });
        }

        const shippingPayload = buildShippingPayload(shippingInfo);
        if (!shippingPayload.fullName || !shippingPayload.phone || !shippingPayload.address) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin giao hàng." });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, message: "Giỏ hàng trống. Không thể tạo đơn hàng." });

        const items = cart.items.map((item) => {
            const product = item.productId;
            if (!product) return null;
            const price = toNumber(product.price);
            const oldPrice = toNumber(product.oldPrice);
            const hasSale = oldPrice > price && oldPrice > 0;
            return { productId: product._id, name: product.name, image: product.image || "", price, oldPrice: hasSale ? oldPrice : price, quantity: item.quantity, selectedColor: item.selectedColor || "" };
        }).filter(Boolean);

        if (!items.length) return res.status(400).json({ success: false, message: "Không thể tạo đơn hàng vì sản phẩm không hợp lệ." });

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) return res.status(400).json({ success: false, message: `Sản phẩm "${item.name}" không tồn tại.` });
            if (!product.inStock) return res.status(400).json({ success: false, message: `Sản phẩm "${item.name}" hiện không còn hàng.` });

            const colorName = item.selectedColor || "";
            let availableStock = product.stock;
            if (product.colorStocks?.length > 0) {
                const colorStock = product.colorStocks.find((cs) => cs.name === colorName);
                if (colorStock) availableStock = colorStock.stock;
                else if (colorName) return res.status(400).json({ success: false, message: `Màu "${colorName}" không có trong sản phẩm "${item.name}".` });
            }
            if (availableStock < item.quantity) return res.status(400).json({ success: false, message: `Sản phẩm "${item.name}" không đủ số lượng. Còn lại: ${availableStock}` });
        }

        const subTotal = items.reduce((sum, item) => sum + (item.oldPrice || item.price) * item.quantity, 0);
        const total    = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const savings  = subTotal - total;
        const parsedShippingFee = typeof shippingFee === "number" ? shippingFee : parseFloat(shippingFee) || 0;

        let parsedDiscount = typeof discount === "number" ? discount : parseFloat(discount) || 0;
        let appliedCouponId = null;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
            if (coupon && coupon.isValid() && total >= coupon.minOrderValue) {
                parsedDiscount = coupon.calculateDiscount(total);
                appliedCouponId = coupon._id;
            }
        }

        const totals = { subTotal: total, total, savings, shippingFee: parsedShippingFee, discount: parsedDiscount, grandTotal: Math.max(total + parsedShippingFee - parsedDiscount, 0) };

        const order = await createOrderWithRetry({
            userId, items, shippingInfo: shippingPayload, paymentMethod: "cod", totals, status: "pending",
            statusHistory: [{ status: "pending", note: "Đơn hàng được tạo thành công", updatedBy: userId }],
        });

        await decrementStock(items);
        if (appliedCouponId) await incrementUsedCount(appliedCouponId);

        cart.items = [];
        await cart.save();

        return res.status(201).json({ success: true, message: "Đặt hàng thành công", data: order });
    } catch (error) {
        console.error("createOrder error:", error);
        return res.status(500).json({ success: false, message: "Không thể tạo đơn hàng", error: error.message });
    }
};

// ===== USER ORDERS =====
const getUserOrders = async (req, res) => {
    try {
        const authUserId = req.user?._id?.toString();
        const { userId } = req.params;

        if (!authUserId || (userId && authUserId !== userId)) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền xem đơn hàng này." });
        }

        // FIX 2: Exclude TEMP_ placeholder orders from user view
        const orders = await Order.find({
            userId: authUserId,
            code: { $not: /^TEMP_/ },
        }).sort({ createdAt: -1 });

        return res.json({ success: true, data: orders });
    } catch (error) {
        console.error("getUserOrders error:", error);
        return res.status(500).json({ success: false, message: "Không thể lấy danh sách đơn hàng", error: error.message });
    }
};

// ===== ORDER DETAIL =====
const getOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;
        const authUser = req.user;

        const queries = [{ code: orderId }];
        if (mongoose.Types.ObjectId.isValid(orderId)) queries.push({ _id: orderId });

        const order = await Order.findOne({ $or: queries });
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng." });

        const isAdmin = authUser?.role === "admin";
        // FIX 3: Use toString() for consistent ObjectId comparison
        const isOwner = authUser?._id?.toString() === order.userId?.toString();
        if (!isAdmin && !isOwner) return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập đơn hàng này." });

        return res.json({ success: true, data: order });
    } catch (error) {
        console.error("getOrderDetail error:", error);
        return res.status(500).json({ success: false, message: "Không thể lấy chi tiết đơn hàng", error: error.message });
    }
};

// ===== ADMIN: GET ALL ORDERS =====
const getAllOrders = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status && Order.STATUSES.includes(status)) filter.status = status;

        // FIX 2: Exclude TEMP_ orders from admin view
        const orders = await Order.find({ ...filter, code: { $not: /^TEMP_/ } }).sort({ createdAt: -1 });

        return res.json({ success: true, data: orders });
    } catch (error) {
        console.error("getAllOrders error:", error);
        return res.status(500).json({ success: false, message: "Không thể tải danh sách đơn hàng", error: error.message });
    }
};

// ===== UPDATE STATUS (ADMIN) =====
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;
        const adminId = req.user?._id?.toString();

        if (!Order.STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng." });

        const oldStatus = order.status;
        if (status === "cancelled" && oldStatus !== "cancelled") await restoreStock(order.items);

        order.status = status;
        order.statusHistory.push({ status, note: note || STATUS_LABELS[status], updatedBy: adminId || "admin", updatedAt: new Date() });
        if (status === "delivered" || status === "received") order.paymentStatus = "paid";

        await order.save();
        return res.json({ success: true, message: "Cập nhật trạng thái thành công", data: order });
    } catch (error) {
        console.error("updateOrderStatus error:", error);
        return res.status(500).json({ success: false, message: "Không thể cập nhật trạng thái đơn hàng", error: error.message });
    }
};

// ===== ADMIN DELETE ORDER =====
const deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng." });

        if (!["pending", "cancelled"].includes(order.status)) {
            return res.status(400).json({ success: false, message: "Chỉ có thể xoá đơn hàng ở trạng thái 'Chờ xác nhận' hoặc 'Đã huỷ'." });
        }

        if (order.status === "pending") await restoreStock(order.items);
        await Order.findByIdAndDelete(orderId);

        return res.json({ success: true, message: "Đã xoá đơn hàng thành công." });
    } catch (error) {
        console.error("deleteOrder error:", error);
        return res.status(500).json({ success: false, message: "Không thể xoá đơn hàng.", error: error.message });
    }
};

// ===== USER CANCEL ORDER =====
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id?.toString();

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng." });
        if (order.userId.toString() !== userId) return res.status(403).json({ success: false, message: "Bạn không có quyền hủy đơn hàng này." });
        if (order.status !== "pending") return res.status(400).json({ success: false, message: "Chỉ có thể hủy đơn hàng khi đang ở trạng thái 'Chờ xác nhận'." });

        await restoreStock(order.items);

        order.status = "cancelled";
        order.statusHistory.push({ status: "cancelled", note: "Khách hàng hủy đơn hàng", updatedBy: userId, updatedAt: new Date() });
        await order.save();

        return res.json({ success: true, message: "Đã hủy đơn hàng thành công", data: order });
    } catch (error) {
        console.error("cancelOrder error:", error);
        return res.status(500).json({ success: false, message: "Không thể hủy đơn hàng", error: error.message });
    }
};

// ===== USER CONFIRM RECEIVED =====
const confirmOrderReceived = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id?.toString();

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng." });
        // FIX 3: toString() for ObjectId comparison
        if (order.userId?.toString() !== userId) return res.status(403).json({ success: false, message: "Bạn không có quyền xác nhận đơn hàng này." });
        if (!["delivered", "shipping"].includes(order.status)) return res.status(400).json({ success: false, message: "Chỉ có thể xác nhận khi đơn đã giao." });

        order.status = "received";
        order.paymentStatus = "paid";
        order.statusHistory.push({ status: "received", note: "Khách đã xác nhận nhận hàng", updatedBy: userId, updatedAt: new Date() });
        await order.save();

        return res.json({ success: true, message: "Cảm ơn bạn đã xác nhận!", data: order });
    } catch (error) {
        console.error("confirmOrderReceived error:", error);
        return res.status(500).json({ success: false, message: "Không thể xác nhận đơn hàng", error: error.message });
    }
};

// ===== CREATE ORDER FROM ONLINE PAYMENT CALLBACK (MoMo / ZaloPay) =====
const createOrderFromPayment = async (orderData, transId, method = "momo") => {
    try {
        const { userId, shippingInfo, shippingFee, discount, items: cartItems } = orderData;

        if (!userId || !cartItems?.length) {
            console.error("createOrderFromPayment: missing userId or items");
            return null;
        }

        const shippingPayload = buildShippingPayload(shippingInfo);

        const items = [];
        for (const cartItem of cartItems) {
            const product = await Product.findById(cartItem.productId);
            if (!product) { console.error(`Product ${cartItem.productId} not found`); return null; }
            items.push({
                productId:     cartItem.productId,
                name:          cartItem.name || product.name,
                image:         cartItem.image || product.image || "",
                price:         toNumber(cartItem.price) || toNumber(product.price),
                oldPrice:      toNumber(cartItem.oldPrice) || toNumber(product.oldPrice) || toNumber(cartItem.price) || toNumber(product.price),
                quantity:      cartItem.quantity,
                selectedColor: cartItem.selectedColor || "",
            });
        }

        const subTotal         = items.reduce((sum, i) => sum + (i.oldPrice || i.price) * i.quantity, 0);
        const total            = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const savings          = subTotal - total;
        const parsedShippingFee = typeof shippingFee === "number" ? shippingFee : parseFloat(shippingFee) || 0;
        const parsedDiscount   = typeof discount === "number" ? discount : parseFloat(discount) || 0;

        const totals = {
            subTotal: total, total, savings,
            shippingFee: parsedShippingFee,
            discount: parsedDiscount,
            grandTotal: Math.max(total + parsedShippingFee - parsedDiscount, 0),
        };

        const order = await createOrderWithRetry({
            userId, items, shippingInfo: shippingPayload,
            paymentMethod: method,
            paymentStatus: "paid",
            status: "pending",
            totals,
            statusHistory: [{
                status: "pending",
                note: `Thanh toán ${method.toUpperCase()} thành công. Mã giao dịch: ${transId}.`,
                updatedBy: "system",
            }],
        });

        // FIX 4: decrement stock after online payment confirmed
        await decrementStock(items);

        // FIX 5: clear cart after online payment
        await Cart.updateOne({ userId }, { $set: { items: [] } });

        return order;
    } catch (error) {
        console.error("createOrderFromPayment error:", error);
        return null;
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderDetail,
    getAllOrders,
    updateOrderStatus,
    deleteOrder,
    cancelOrder,
    confirmOrderReceived,
    createOrderFromPayment,
};