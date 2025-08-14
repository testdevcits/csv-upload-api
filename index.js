require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const log = require("./logging");
const Order = require("./models/Order");

const app = express();

// Middleware to parse JSON
app.use(express.json({ limit: "10mb" }));

// Connect to MongoDB
if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/pwnorders", {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => log("MongoDB connected", "INFO"))
    .catch((err) => log(`MongoDB connection error: ${err}`, "ERROR"));
}

// Health check
app.get("/", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  log("Server running", "INFO", clientIp);
  res.send("✅ Server running");
});

// JSON upload endpoint (no CSV parsing)
app.post("/upload-json", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    const orders = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      log("Invalid JSON payload: must be a non-empty array", "ERROR", clientIp);
      return res.status(400).json({
        status: "error",
        message: "Payload must be a non-empty JSON array",
      });
    }

    const invalid = orders.filter((o) => !o.pwnOrderId || !o.email);
    if (invalid.length > 0) {
      log(`Invalid records: missing pwnOrderId or email`, "ERROR", clientIp);
      return res.status(400).json({
        status: "error",
        message: `Some records are missing required fields. Invalid count: ${invalid.length}`,
      });
    }

    const inserted = await Order.insertMany(orders, { ordered: false });
    log(`Inserted ${inserted.length} orders`, "INFO", clientIp);

    res.json({
      status: "success",
      message: `JSON uploaded and saved. Rows inserted: ${inserted.length}`,
    });
  } catch (err) {
    log(`DB insert error: ${err}`, "ERROR", clientIp);
    res.status(500).json({
      status: "error",
      message: "Error saving data to DB",
      details: err.message,
    });
  }
});

// Export for Vercel
module.exports = app;

// Local dev mode
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => log(`Server listening on port ${PORT}`, "INFO"));
}
