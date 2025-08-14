require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
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
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

// Health check
app.get("/", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log(`Server running - IP: ${clientIp}`);
  res.send("✅ Server running");
});

// Upload JSON data
app.post("/upload-json", async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    const orders = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      console.error(`❌ Invalid payload from ${clientIp}`);
      return res.status(400).json({
        status: "error",
        message: "Payload must be a non-empty JSON array",
      });
    }

    // Validate required fields
    const invalid = orders.filter((o) => !o.pwnOrderId || !o.email);
    if (invalid.length > 0) {
      console.error(`❌ Invalid records from ${clientIp}`);
      return res.status(400).json({
        status: "error",
        message: `Some records are missing required fields (pwnOrderId, email). Invalid count: ${invalid.length}`,
      });
    }

    // Insert into MongoDB
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

// Export for Vercel
module.exports = app;

// Local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
}
