require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const log = require("../logging"); // adjust path for moved file
const Order = require("../models/Order");

const app = express();
const upload = multer({ dest: "uploads/" });

// Connect to MongoDB (only if not already connected)
if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/pwnorders")
    .then(() => log("MongoDB connected", "INFO"))
    .catch((err) => log(`MongoDB connection error: ${err}`, "ERROR"));
}

// Root route
app.get("/", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  log("Status check: Server running", "INFO", clientIp);
  res.send("✅ Server running");
});

// Upload CSV endpoint
app.post("/upload-csv", upload.single("file"), (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (!req.file) {
    log("No file uploaded", "ERROR", clientIp);
    return res.status(400).json({ error: "No file uploaded" });
  }

  const orders = [];
  const filePath = req.file.path;
  const csvEncoding = process.env.CSV_ENCODING || "utf-8";

  fs.createReadStream(filePath, { encoding: csvEncoding })
    .pipe(csvParser())
    .on("data", (row) => {
      if (!row.pwnOrderId || !row.email) {
        log(
          "Skipping invalid row: missing pwnOrderId or email",
          "ERROR",
          clientIp
        );
        return;
      }
      orders.push({
        pwnOrderId: row.pwnOrderId,
        pwnOrderStatus: row.pwnOrderStatus,
        confirmationCode: row.confirmationCode,
        pwnCreatedAt: new Date(row.pwnCreatedAt),
        pwnExpiresAt: new Date(row.pwnExpiresAt),
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
        dob: new Date(row.dob),
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
        log(`Inserted ${orders.length} orders from CSV.`, "INFO", clientIp);
        res.json({ message: "CSV data uploaded and saved successfully" });
      } catch (err) {
        log(`Error saving data to database: ${err}`, "ERROR", clientIp);
        res.status(500).json({ error: "Error saving data to database" });
      } finally {
        fs.unlink(filePath, (err) => {
          if (err) log(`Error deleting file: ${err}`, "ERROR", clientIp);
        });
      }
    })
    .on("error", (error) => {
      log(`Error parsing CSV file: ${error}`, "ERROR", clientIp);
      fs.unlink(filePath, (err) => {
        if (err) log(`Error deleting file: ${err}`, "ERROR", clientIp);
      });
      res.status(400).json({ error: "Error parsing CSV file" });
    });
});

// Export for Vercel
module.exports = app;

// Run locally with nodemon
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    log(`Server listening on port ${PORT}`, "INFO");
  });
}
