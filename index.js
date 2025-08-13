require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");
const log = require("./logging"); // logging helper
const Order = require("./models/Order");

const app = express();

// Upload folder
const uploadDir =
  process.env.NODE_ENV === "production"
    ? "/tmp/uploads"
    : path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

// Connect MongoDB
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

// Upload CSV
app.post("/upload-csv", upload.single("file"), async (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (!req.file) {
    log("No file uploaded", "ERROR", clientIp);
    return res
      .status(400)
      .json({ status: "error", message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const orders = [];
  const batchSize = 10; // Send 10 rows per batch

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
      // Validate required fields
      if (!row.pwnOrderId || !row.email) {
        log(
          `Skipping invalid row: missing pwnOrderId or email`,
          "ERROR",
          clientIp
        );
        return;
      }

      // Convert providerId to number safely
      let providerId = Number(row.providerId);
      if (isNaN(providerId)) providerId = null;

      // Convert dates safely
      const pwnCreatedAt = row.pwnCreatedAt ? new Date(row.pwnCreatedAt) : null;
      const dob = row.dob ? new Date(row.dob) : null;

      orders.push({
        pwnOrderId: row.pwnOrderId,
        pwnOrderStatus: row.pwnOrderStatus,
        confirmationCode: row.confirmationCode,
        pwnCreatedAt,
        pwnExpiresAt: row.pwnExpiresAt ? new Date(row.pwnExpiresAt) : null,
        address: row.address,
        visitType: row.visitType,
        testTypes: row.testTypes,
        reasonForTesting: row.reasonForTesting,
        pwnLink: row.pwnLink,
        pwnPhysicianName: row.pwnPhysicianName,
        externalId: row.externalId,
        providerId,
        firstName: row.firstName,
        lastName: row.lastName,
        dob,
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
      let insertedTotal = 0;

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        try {
          const inserted = await Order.insertMany(batch, { ordered: false });
          insertedTotal += inserted.length;
          log(
            `Batch ${i / batchSize + 1} inserted: ${inserted.length} rows`,
            "INFO",
            clientIp
          );
        } catch (err) {
          log(
            `Batch ${i / batchSize + 1} insert error: ${err.message || err}`,
            "ERROR",
            clientIp
          );
        }
      }

      // Delete CSV file
      fs.unlink(filePath, (err) => {
        if (err) log(`Error deleting file: ${err}`, "ERROR", clientIp);
      });

      res.json({
        status: "success",
        message: `CSV uploaded and saved to DB. Total rows inserted: ${insertedTotal}`,
      });
    })
    .on("error", (err) => {
      log(`CSV parse error: ${err}`, "ERROR", clientIp);
      fs.unlink(filePath, () => {});
      res
        .status(400)
        .json({ status: "error", message: "Error parsing CSV file" });
    });
});

// Export for Vercel
module.exports = app;

// Local dev
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => log(`Server listening on port ${PORT}`, "INFO"));
}
