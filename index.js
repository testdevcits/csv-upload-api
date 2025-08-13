require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");
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
  mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/pwnorders",
    { serverSelectionTimeoutMS: 5000 }
  );
}

// Health check
app.get("/", (req, res) => {
  res.send("✅ Server running");
});

// Upload CSV
app.post("/upload-csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ status: "error", message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const orders = [];
  const batchSize = 10;

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
      if (!row.pwnOrderId || !row.email) {
        return; // skip invalid rows
      }

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
      let insertedTotal = 0;

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        try {
          const inserted = await Order.insertMany(batch, { ordered: false });
          insertedTotal += inserted.length;
        } catch (err) {
          // silently ignore batch errors
        }
      }

      fs.unlink(filePath, () => {});
      res.json({
        status: "success",
        message: `CSV uploaded and saved to DB. Total rows inserted: ${insertedTotal}`,
      });
    })
    .on("error", () => {
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
  app.listen(PORT, () => {});
}
