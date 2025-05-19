import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import axios from "axios";
import fetch from "node-fetch";
import {
  addOrderItems,
  getMyOrders,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDeliver,
  getOrders,
} from "../controllers/orderController.js";
import validateRequest from "../middleware/validator.js";
import { param, check } from "express-validator";
import { order } from "../controllers/paymentController.js";

const router = express.Router();

const validator = {
  getOrderById: [
    param("id")
      .notEmpty()
      .withMessage("Id is required")
      .isMongoId()
      .withMessage("Invalid Id Format"),
  ],
  updateOrderToPaid: [
    param("id")
      .notEmpty()
      .withMessage("Id is required")
      .isMongoId()
      .withMessage("Invalid Id Format"),
  ],
  updateOrderToDeliver: [
    param("id")
      .notEmpty()
      .withMessage("Id is required")
      .isMongoId()
      .withMessage("Invalid Id Format"),
  ],
  addOrderItems: [
    check("cartItems").notEmpty().withMessage("Cart items are required"),
    check("shippingAddress")
      .notEmpty()
      .withMessage("Shipping address is required"),
    check("paymentMethod").notEmpty().withMessage("Payment method is required"),
    check("itemsPrice")
      .notEmpty()
      .withMessage("Items price is required")
      .isNumeric()
      .withMessage("Items price must be a number"),
    check("taxPrice")
      .notEmpty()
      .withMessage("Tax price is required")
      .isNumeric()
      .withMessage("Tax price must be a number"),
    check("shippingPrice")
      .notEmpty()
      .withMessage("Shipping price is required")
      .isNumeric()
      .withMessage("Shipping price must be a number"),
    check("totalPrice")
      .notEmpty()
      .withMessage("Total price is required")
      .isNumeric()
      .withMessage("Total price must be a number"),
  ],
};

router
  .route("/")
  .post(validator.addOrderItems, validateRequest, protect, addOrderItems)
  .get(protect, admin, getOrders);

router.get("/my-orders", protect, getMyOrders);
router.get(
  "/:id",
  validator.getOrderById,
  validateRequest,
  protect,
  getOrderById
);
router.put(
  "/:id/pay",
  validator.updateOrderToPaid,
  validateRequest,
  protect,
  updateOrderToPaid
);
router.put(
  "/:id/deliver",
  validator.updateOrderToDeliver,
  validateRequest,
  protect,
  admin,
  updateOrderToDeliver
);

const PAYPAL_API = "https://api-m.sandbox.paypal.com"; // Sandbox URL

const PAYPAL_CLIENT_ID =
  "AaxvEF51oFW9PgKxWtpCELNFWPtGTHac1RftYMvIZxW_BL_AYaj0atnRhemesP_4S7cshTFwfxMlmjoq";
const PAYPAL_CLIENT_SECRET =
  "EHH87QKOortha0nfDklU8TZ8P4RTii6XEMSlB9TBN-8kxP83gPPk4OAp4MR13mmHEijDxroxjcr-xK1h";
// Generate PayPal Access Token
const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("Missing PayPal Client ID or Secret");
    }

    const response = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("PayPal API Error:", error.response?.data || error.message);
  }
};
router.post("/paypal/create-order", async (req, res) => {
  const accessToken = await generateAccessToken();
  const { amount } = req.body;
  const orderData = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: amount,
        },
      },
    ],
  };

  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  });

  const order = await response.json();
  res.json(order);
});

// Capture Payment (After User Approves)
router.post("/paypal/capture-order", async (req, res) => {
  const { orderID } = req.body;
  console.log(orderID);
  const accessToken = await generateAccessToken();

  const response = await fetch(
    `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const captureData = await response.json();
  res.json(captureData);
});
export default router;
