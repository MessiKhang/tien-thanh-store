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

// ===== CREATE ORDER =====
const createOrder = async (req, res) => {
    try {
        const authUserId = req.user?._id?.toString();
        const {
            userId: bodyUserId,
            shippingInfo,
            paymentMethod = "cod",
            shippingFee = 0,
            discount = 0,
            couponCode,
        } = req.body;
        const userId = authUserId || bodyUserId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin user. Vui lòng đăng nhập lại.",
            });
        }

        const shippingPayload = buildShippingPayload(shippingInfo);
        if (
            !shippingPayload.fullName ||
            !shippingPayload.phone ||
            !shippingPayload.address
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin giao hàng.",
            });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống. Không thể tạo đơn hàng.",
            });
        }

        const items = cart.items
            .map((item) => {
                const product = item.productId;
                if (!product) return null;

                const price = toNumber(product.price);
                const oldPrice = toNumber(product.oldPrice);
                const hasSale = oldPrice > price && oldPrice > 0;

                return {
                    productId: product._id,
                    name: product.name,
                    image: product.image || "",
                    price: price, // Giá giảm (sau sale)
                    oldPrice: hasSale ? oldPrice : price, // Giá gốc (nếu có sale thì dùng oldPrice, không thì dùng price)
                    quantity: item.quantity,
                    selectedColor: item.selectedColor || "", // Lưu màu sắc đã chọn
                };
            })
            .filter(Boolean);

        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "Không thể tạo đơn hàng vì sản phẩm không hợp lệ.",
            });
        }

        // Kiểm tra stock trước khi tạo order
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Sản phẩm "${item.name}" không tồn tại.`,
                });
            }
            if (!product.inStock) {
                return res.status(400).json({
                    success: false,
                    message: `Sản phẩm "${item.name}" hiện không còn hàng.`,
                });
            }

            // Kiểm tra stock theo màu nếu có colorStocks
            const colorName = item.selectedColor || "";
            let availableStock = product.stock; // Stock tổng (fallback)

            if (product.colorStocks && product.colorStocks.length > 0) {
                const colorStock = product.colorStocks.find(
                    (cs) => cs.name === colorName,
                );
                if (colorStock) {
                    availableStock = colorStock.stock;
                } else if (colorName) {
                    return res.status(400).json({
                        success: false,
                        message: `Màu "${colorName}" không có trong sản phẩm "${item.name}".`,
                    });
                }
            }

            if (availableStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Sản phẩm "${item.name}" (màu: ${colorName || "không có"}) không đủ số lượng. Số lượng còn lại: ${availableStock}`,
                });
            }
        }

        // Tạm tính (tính theo giá gốc)
        const subTotal = items.reduce(
            (sum, item) => sum + (item.oldPrice || item.price) * item.quantity,
            0,
        );

        // Tổng tiền (tính theo giá giảm)
        const total = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );

        // Tiết kiệm
        const savings = subTotal - total;
        const parsedShippingFee =
            typeof shippingFee === "number"
                ? shippingFee
                : parseFloat(shippingFee) || 0;

        // Xử lý mã giảm giá
        let parsedDiscount =
            typeof discount === "number" ? discount : parseFloat(discount) || 0;
        let appliedCouponId = null;

        if (couponCode) {
            const coupon = await Coupon.findOne({
                code: couponCode.toUpperCase().trim(),
            });
            if (coupon && coupon.isValid()) {
                if (total >= coupon.minOrderValue) {
                    const couponDiscount = coupon.calculateDiscount(total);
                    parsedDiscount = couponDiscount;
                    appliedCouponId = coupon._id;
                }
            }
        }

        const totals = {
            subTotal: total, // Tạm tính (giá giảm)
            total: total, // Thành tiền (giá giảm - trước voucher)
            savings, // Tiết kiệm
            shippingFee: parsedShippingFee,
            discount: parsedDiscount,
            grandTotal: Math.max(total + parsedShippingFee - parsedDiscount, 0), // Tổng cộng (thành tiền + ship - discount)
        };

        // Chỉ tạo đơn cho COD (thanh toán online tạo trong callback)
        if (ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message:
                    "Thanh toán online phải thực hiện qua cổng thanh toán.",
            });
        }

        const initialStatus = "pending";
        const statusNote = "Đơn hàng được tạo thành công";

        // Retry logic để xử lý duplicate key error
        let order;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                order = await Order.create({
                    userId,
                    items,
                    shippingInfo: shippingPayload,
                    paymentMethod: Order.PAYMENT_METHODS.includes(paymentMethod)
                        ? paymentMethod
                        : "cod",
                    totals,
                    status: initialStatus,
                    statusHistory: [
                        {
                            status: initialStatus,
                            note: statusNote,
                            updatedBy: userId,
                        },
                    ],
                });
                break; // Thành công, thoát khỏi vòng lặp
            } catch (createError) {
                // Nếu lỗi duplicate key, thử lại
                if (
                    createError.code === 11000 ||
                    createError.codeName === "DuplicateKey"
                ) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw new Error(
                            "Không thể tạo mã đơn hàng duy nhất. Vui lòng thử lại.",
                        );
                    }
                    // Đợi một chút trước khi thử lại
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    continue;
                }
                throw createError; // Nếu lỗi khác, throw ngay
            }
        }

        if (!order) {
            throw new Error("Không thể tạo đơn hàng sau nhiều lần thử");
        }

        // Giảm stock cho đơn COD (thanh toán online giảm trong callback)
        {
            for (const item of items) {
                const product = await Product.findById(item.productId);
                const colorName = item.selectedColor || "";

                // Giảm stock tổng
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: -item.quantity } },
                    { new: true },
                );

                // Giảm stock theo màu nếu có colorStocks
                if (product.colorStocks && product.colorStocks.length > 0) {
                    const colorStockIndex = product.colorStocks.findIndex(
                        (cs) => cs.name === colorName,
                    );
                    if (colorStockIndex !== -1) {
                        const updateField = `colorStocks.${colorStockIndex}.stock`;
                        await Product.findByIdAndUpdate(
                            item.productId,
                            { $inc: { [updateField]: -item.quantity } },
                            { new: true },
                        );
                    }
                }

                // Kiểm tra và cập nhật inStock nếu stock = 0
                const updatedProduct = await Product.findById(item.productId);
                if (updatedProduct) {
                    // Kiểm tra stock tổng
                    if (updatedProduct.stock <= 0) {
                        await Product.findByIdAndUpdate(item.productId, {
                            inStock: false,
                        });
                    }
                    // Kiểm tra stock theo màu
                    if (
                        updatedProduct.colorStocks &&
                        updatedProduct.colorStocks.length > 0
                    ) {
                        const allColorsOutOfStock =
                            updatedProduct.colorStocks.every(
                                (cs) => cs.stock <= 0,
                            );
                        if (allColorsOutOfStock) {
                            await Product.findByIdAndUpdate(item.productId, {
                                inStock: false,
                            });
                        }
                    }
                }
            }
        }

        // Tăng số lượt sử dụng của mã giảm giá nếu có
        if (appliedCouponId) {
            await incrementUsedCount(appliedCouponId);
        }

        cart.items = [];
        await cart.save();

        res.status(201).json({
            success: true,
            message: "Đặt hàng thành công",
            data: order,
        });
    } catch (error) {
        console.error("createOrder error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể tạo đơn hàng",
            error: error.message,
        });
    }
};

// ===== USER ORDERS =====
const getUserOrders = async (req, res) => {
    try {
        const authUserId = req.user?._id?.toString();
        const { userId } = req.params;

        if (!authUserId || (userId && authUserId !== userId)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem đơn hàng này.",
            });
        }

        const orders = await Order.find({ userId: authUserId }).sort({
            createdAt: -1,
        });

        res.json({
            success: true,
            data: orders,
        });
    } catch (error) {
        console.error("getUserOrders error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách đơn hàng",
            error: error.message,
        });
    }
};

// ===== ORDER DETAIL =====
const getOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;
        const authUser = req.user;

        const queries = [{ code: orderId }];
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            queries.push({ _id: orderId });
        }

        const order = await Order.findOne({ $or: queries });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng.",
            });
        }

        const isAdmin = authUser?.role === "admin";
        const isOwner = authUser?._id?.toString() === order.userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập đơn hàng này.",
            });
        }

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        console.error("getOrderDetail error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết đơn hàng",
            error: error.message,
        });
    }
};

// ===== ADMIN: GET ALL ORDERS =====
const getAllOrders = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};

        if (status && Order.STATUSES.includes(status)) {
            filter.status = status;
        }

        const orders = await Order.find(filter).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: orders,
        });
    } catch (error) {
        console.error("getAllOrders error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể tải danh sách đơn hàng",
            error: error.message,
        });
    }
};

// ===== UPDATE STATUS (ADMIN) =====
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;
        const adminId = req.user?._id?.toString();

        if (!Order.STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ.",
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng.",
            });
        }

        const oldStatus = order.status;

        // Nếu hủy đơn hàng, hoàn lại stock
        if (status === "cancelled" && oldStatus !== "cancelled") {
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                const colorName = item.selectedColor || "";

                // Hoàn lại stock tổng
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: item.quantity } },
                    { new: true },
                );

                // Hoàn lại stock theo màu nếu có colorStocks
                if (
                    product &&
                    product.colorStocks &&
                    product.colorStocks.length > 0
                ) {
                    const colorStockIndex = product.colorStocks.findIndex(
                        (cs) => cs.name === colorName,
                    );
                    if (colorStockIndex !== -1) {
                        const updateField = `colorStocks.${colorStockIndex}.stock`;
                        await Product.findByIdAndUpdate(
                            item.productId,
                            { $inc: { [updateField]: item.quantity } },
                            { new: true },
                        );
                    }
                }

                // Cập nhật inStock nếu stock > 0
                const updatedProduct = await Product.findById(item.productId);
                if (updatedProduct && updatedProduct.stock > 0) {
                    await Product.findByIdAndUpdate(item.productId, {
                        inStock: true,
                    });
                }
            }
        }

        order.status = status;
        order.statusHistory.push({
            status,
            note: note || STATUS_LABELS[status],
            updatedBy: adminId || "admin",
            updatedAt: new Date(),
        });

        if (status === "delivered" || status === "received") {
            order.paymentStatus = "paid";
        }

        await order.save();

        res.json({
            success: true,
            message: "Cập nhật trạng thái thành công",
            data: order,
        });
    } catch (error) {
        console.error("updateOrderStatus error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể cập nhật trạng thái đơn hàng",
            error: error.message,
        });
    }
};

// ===== USER CANCEL ORDER =====
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id?.toString();

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng.",
            });
        }

        // Chỉ cho phép user hủy đơn của chính họ
        if (order.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền hủy đơn hàng này.",
            });
        }

        // Chỉ cho phép hủy khi đơn ở trạng thái "pending"
        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Chỉ có thể hủy đơn hàng khi đang ở trạng thái 'Chờ xác nhận'.",
            });
        }

        // Hoàn lại stock khi hủy đơn
        {
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                const colorName = item.selectedColor || "";

                // Hoàn lại stock tổng
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: item.quantity } },
                    { new: true },
                );

                // Hoàn lại stock theo màu nếu có colorStocks
                if (
                    product &&
                    product.colorStocks &&
                    product.colorStocks.length > 0
                ) {
                    const colorStockIndex = product.colorStocks.findIndex(
                        (cs) => cs.name === colorName,
                    );
                    if (colorStockIndex !== -1) {
                        const updateField = `colorStocks.${colorStockIndex}.stock`;
                        await Product.findByIdAndUpdate(
                            item.productId,
                            { $inc: { [updateField]: item.quantity } },
                            { new: true },
                        );
                    }
                }

                // Cập nhật inStock nếu stock > 0
                const updatedProduct = await Product.findById(item.productId);
                if (updatedProduct && updatedProduct.stock > 0) {
                    await Product.findByIdAndUpdate(item.productId, {
                        inStock: true,
                    });
                }
            }
        }

        order.status = "cancelled";
        order.statusHistory.push({
            status: "cancelled",
            note: "Khách hàng hủy đơn hàng",
            updatedBy: userId,
            updatedAt: new Date(),
        });

        await order.save();

        res.json({
            success: true,
            message: "Đã hủy đơn hàng thành công",
            data: order,
        });
    } catch (error) {
        console.error("cancelOrder error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể hủy đơn hàng",
            error: error.message,
        });
    }
};

// ===== USER CONFIRM RECEIVED =====
const confirmOrderReceived = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id?.toString();

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng.",
            });
        }

        if (order.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xác nhận đơn hàng này.",
            });
        }

        if (!["delivered", "shipping"].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: "Chỉ có thể xác nhận khi đơn đã giao.",
            });
        }

        order.status = "received";
        order.paymentStatus = "paid";
        order.statusHistory.push({
            status: "received",
            note: "Khách đã xác nhận nhận hàng",
            updatedBy: userId,
            updatedAt: new Date(),
        });

        await order.save();

        res.json({
            success: true,
            message: "Cảm ơn bạn đã xác nhận!",
            data: order,
        });
    } catch (error) {
        console.error("confirmOrderReceived error:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xác nhận đơn hàng",
            error: error.message,
        });
    }
};

// ===== TẠO ĐƠN HÀNG TỪ CALLBACK MOMO =====
const createOrderFromMomo = async (orderData, transId) => {
    try {
        const {
            userId,
            shippingInfo,
            paymentMethod,
            shippingFee,
            discount,
            couponCode,
            items: cartItems,
        } = orderData;

        if (!userId || !cartItems || cartItems.length === 0) {
            console.error("createOrderFromMomo: Thiếu thông tin đơn hàng");
            return null;
        }

        const shippingPayload = buildShippingPayload(shippingInfo);

        // Fetch thông tin product từ database vì frontend có thể không gửi đầy đủ
        const items = [];
        for (const cartItem of cartItems) {
            const product = await Product.findById(cartItem.productId);
            if (!product) {
                console.error(`Product ${cartItem.productId} not found`);
                return null;
            }

            items.push({
                productId: cartItem.productId,
                name: cartItem.name || product.name,
                image: cartItem.image || product.image || "",
                price: cartItem.price || product.price,
                oldPrice:
                    cartItem.oldPrice ||
                    product.oldPrice ||
                    cartItem.price ||
                    product.price,
                quantity: cartItem.quantity,
                selectedColor: cartItem.selectedColor || "",
            });
        }

        // Tính toán totals
        const subTotal = items.reduce(
            (sum, item) => sum + (item.oldPrice || item.price) * item.quantity,
            0,
        );
        const total = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );
        const savings = subTotal - total;
        const parsedShippingFee =
            typeof shippingFee === "number"
                ? shippingFee
                : parseFloat(shippingFee) || 0;
        const parsedDiscount =
            typeof discount === "number" ? discount : parseFloat(discount) || 0;

        const totals = {
            subTotal: total,
            total: total,
            savings,
            shippingFee: parsedShippingFee,
            discount: parsedDiscount,
            grandTotal: Math.max(total + parsedShippingFee - parsedDiscount, 0),
        };

        // Retry logic để xử lý duplicate key error
        let order;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                order = await Order.create({
                    userId,
                    items,
                    shippingInfo: shippingPayload,
                    paymentMethod: "momo",
                    paymentStatus: "paid", // Đã thanh toán thành công qua MoMo
                    status: "pending", // Đơn hàng được xác nhận
                    totals,
                    statusHistory: [
                        {
                            status: "pending",
                            note: `Thanh toán MOMO thành công. Mã giao dịch: ${transId}. Đơn hàng được tạo.`,
                            updatedBy: "system",
                        },
                    ],
                });
                break;
            } catch (createError) {
                if (
                    createError.code === 11000 ||
                    createError.codeName === "DuplicateKey"
                ) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw new Error("Không thể tạo mã đơn hàng duy nhất");
                    }
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    continue;
                }
                throw createError;
            }
        }

        if (!order) {
            throw new Error("Không thể tạo đơn hàng");
        }

        // Giảm stock cho các sản phẩm
        for (const item of items) {
            const product = await Product.findById(item.productId);
            const colorName = item.selectedColor || "";

            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { stock: -item.quantity } },
                { new: true },
            );

            if (
                product &&
                product.colorStocks &&
                product.colorStocks.length > 0
            ) {
                const colorStockIndex = product.colorStocks.findIndex(
                    (cs) => cs.name === colorName,
                );
                if (colorStockIndex !== -1) {
                    const updateField = `colorStocks.${colorStockIndex}.stock`;
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { [updateField]: -item.quantity } },
                        { new: true },
                    );
                }
            }

            const updatedProduct = await Product.findById(item.productId);
            if (updatedProduct) {
                if (updatedProduct.stock <= 0) {
                    await Product.findByIdAndUpdate(item.productId, {
                        inStock: false,
                    });
                }
                if (
                    updatedProduct.colorStocks &&
                    updatedProduct.colorStocks.length > 0
                ) {
                    const allColorsOutOfStock =
                        updatedProduct.colorStocks.every((cs) => cs.stock <= 0);
                    if (allColorsOutOfStock) {
                        await Product.findByIdAndUpdate(item.productId, {
                            inStock: false,
                        });
                    }
                }
            }
        }

        return order;
    } catch (error) {
        console.error("createOrderFromMomo error:", error);
        return null;
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderDetail,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    confirmOrderReceived,
    createOrderFromMomo,
};
