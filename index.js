require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");

const log = require("./logging");
const Order = require("./models/Order");

const app = express();

// Upload directory
const uploadDir =
  process.env.NODE_ENV === "production"
    ? "/tmp/uploads"
    : path.join(__dirname, "uploads");

if (process.env.NODE_ENV !== "production" && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Connect to MongoDB
if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => log("MongoDB connected", "INFO"))
    .catch((err) => log(`MongoDB connection error: ${err}`, "ERROR"));
}

// Middleware to check optional Bearer token
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (process.env.API_BEARER_TOKEN) {
    if (!token || token !== `Bearer ${process.env.API_BEARER_TOKEN}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
}

// Root route
app.get("/", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  log("Server running", "INFO", clientIp);
  res.send("✅ Server running");
});

// CSV Upload route (protected if API_BEARER_TOKEN is set)
app.post("/upload-csv", authMiddleware, upload.single("file"), (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const orders = [];
  const filePath = req.file.path;
  const csvEncoding = process.env.CSV_ENCODING || "utf-8";

  fs.createReadStream(filePath, { encoding: csvEncoding })
    .pipe(csvParser())
    .on("data", (row) => {
      if (!row.pwnOrderId || !row.email) return;
      orders.push({
        pwnOrderId: row.pwnOrderId,
        pwnOrderStatus: row.pwnOrderStatus,
        confirmationCode: row.confirmationCode,
        pwnCreatedAt: row.pwnCreatedAt ? new Date(row.pwnCreatedAt) : null,
        pwnExpiresAt: row.pwnExpiresAt ? new Date(row.pwnExpiresAt) : null,
        address: row.address,
        visitType: row.visitType,
        testTypes: row.testTypes,
        reasonForTesting: row.reasonForTesting,
        pwnLink: row.pwnLink,
        pwnPhysicianName: row.pwnPhysicianName,
        externalId: row.externalId,
        providerId: Number(row.providerId),
        firstName: row.firstName,
        lastName: row.lastName,
        dob: row.dob ? new Date(row.dob) : null,
        state: row.state,
        accountNumber: row.accountNumber,
        homePhone: row.homePhone,
        workPhone: row.workPhone,
        mobilePhone: row.mobilePhone,
        zip: row.zip,
        email: row.email,
        gender: row.gender,
      });
    })
    .on("end", async () => {
      try {
        await Order.insertMany(orders, { ordered: false });
        log(`Inserted ${orders.length} orders`, "INFO", clientIp);
        res.json({ message: "CSV uploaded successfully" });
      } catch (err) {
        log(`DB error: ${err}`, "ERROR", clientIp);
        res.status(500).json({ error: "Error saving to DB" });
      } finally {
        fs.unlink(filePath, () => {});
      }
    })
    .on("error", (err) => {
      log(`CSV parse error: ${err}`, "ERROR", clientIp);
      fs.unlink(filePath, () => {});
      res.status(400).json({ error: "Error parsing CSV" });
    });
});

// **Do NOT use app.listen() in production on Vercel**
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => log(`Server running on port ${PORT}`, "INFO"));
}

module.exports = app;
