require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const log = require("./logging"); // your custom logger
const Order = require("./models/Order");

const app = express();

// ===== Upload Directory =====
const uploadDir =
  process.env.NODE_ENV === "production"
    ? "/tmp/uploads"
    : path.join(__dirname, "uploads");

if (process.env.NODE_ENV !== "production" && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// ===== MongoDB Connection =====
if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => log("MongoDB connected", "INFO"))
    .catch((err) => log(`MongoDB connection error: ${err}`, "ERROR"));
}

// ===== Auth Middleware (optional Bearer) =====
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (process.env.API_BEARER_TOKEN) {
    if (!token || token !== `Bearer ${process.env.API_BEARER_TOKEN}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
}

// ===== Root Route =====
app.get("/", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  log("Server running", "INFO", clientIp);
  res.send("✅ Server running");
});

// ===== CSV Upload & Forwarding Route =====
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

      // Transform row into JSON payload
      const addrParts = (row.address || "").split(",");
      const payload = {
        order: {
          reference: row.pwnOrderId,
          bill_type: "1",
          visit_type: row.visitType || "N",
          take_tests_same_day: true,
          account_number: row.accountNumber || "",
          confirmation_code: row.confirmationCode || "",
          test_types: (row.testTypes || "").split(";").map((t) => t.trim()),
          test_names: (row.testTypes || "")
            .split(";")
            .map((t) => t.trim() + " - Test"),
          reason_for_testing: row.reasonForTesting || "routine_check",
          customer: {
            first_name: row.firstName || "",
            last_name: row.lastName || "",
            phone: row.homePhone || "",
            birth_date: row.dob || "",
            gender: row.gender || "",
            email: row.email || "",
            address: {
              line: addrParts[0] || "",
              city: addrParts[1] || "",
              state: row.state || "",
              zip: row.zip || "",
            },
            draw_location: {
              line: addrParts[0] || "",
              city: addrParts[1] || "",
              state: row.state || "",
              zip: row.zip || "",
              country: "USA",
            },
            created_at: row.pwnCreatedAt || "",
            expires_at: row.pwnExpiresAt || "",
            status: row.pwnOrderStatus || "",
            external_id: row.externalId || "",
            provider_id: row.providerId || "",
          },
          physician_review: { name: row.pwnPhysicianName || "" },
          links: { ui_customer: row.pwnLink || "" },
        },
      };

      orders.push(payload);
    })
    .on("end", async () => {
      try {
        // Insert to MongoDB first
        await Order.insertMany(
          orders.map((o) => o.order),
          { ordered: false }
        );
        log(`Inserted ${orders.length} orders`, "INFO", clientIp);

        // Send each order to external API
        const API_URL = process.env.API_URL;
        const errors = [];
        for (let i = 0; i < orders.length; i++) {
          try {
            await axios.post(API_URL, orders[i], {
              headers: {
                "Content-Type": "application/json",
                ...(process.env.API_BEARER_TOKEN
                  ? { Authorization: `Bearer ${process.env.API_BEARER_TOKEN}` }
                  : {}),
              },
            });
          } catch (err) {
            errors.push(
              `Row ${i + 1} failed: ${err.response?.status || ""} - ${
                err.message
              }`
            );
            log(errors[errors.length - 1], "ERROR", clientIp);
          }
        }

        if (errors.length)
          return res
            .status(400)
            .json({ message: "Some rows failed", details: errors });

        res.json({
          message: "CSV uploaded and sent successfully",
          inserted: orders.length,
        });
      } catch (err) {
        log(`DB/Upload error: ${err}`, "ERROR", clientIp);
        res.status(500).json({ error: "Error processing CSV" });
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

// ===== Development Server =====
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => log(`Server running on port ${PORT}`, "INFO"));
}

module.exports = app;
