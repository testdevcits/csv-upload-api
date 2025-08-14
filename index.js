require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Order = require("./models/Order");

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check route
app.get("/", (req, res) => {
  res.send("✅ Server running");
});

// Upload JSON data
app.post("/upload-json", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    const orders = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Payload must be a non-empty JSON array",
      });
    }

    const invalid = orders.filter((o) => !o.pwnOrderId || !o.email);
    if (invalid.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Some records are missing required fields (pwnOrderId, email). Invalid count: ${invalid.length}`,
      });
    }

    const inserted = await Order.insertMany(orders, { ordered: false });
    console.log(`✅ Inserted ${inserted.length} orders from ${clientIp}`);

    res.json({
      status: "success",
      message: `JSON uploaded and saved to DB. Rows inserted: ${inserted.length}`,
    });
  } catch (err) {
    console.error(`❌ DB insert error from ${clientIp}:`, err);
    res.status(500).json({
      status: "error",
      message: "Error saving data to DB",
      details: err.message,
    });
  }
});

// Start server only after MongoDB connects
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

startServer();

module.exports = app;
