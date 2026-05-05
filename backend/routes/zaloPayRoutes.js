const express = require("express");
const {
    createZaloPayPayment,
    zaloPayCallback,
    zaloPayRedirect,
} = require("../controllers/zaloPayController");

const router = express.Router();

// Tạo payment URL
router.post("/create", createZaloPayPayment);

// Callback từ ZaloPay server (IPN)
router.post("/callback", zaloPayCallback);

// Redirect sau khi user thanh toán xong
router.get("/redirect", zaloPayRedirect);

module.exports = router;