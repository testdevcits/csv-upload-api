const fs = require("fs");
const path = require("path");

const logLevel = process.env.LOG_LEVEL || "INFO";
const levels = { ERROR: 0, INFO: 1 };

let logsDir = null;

// Only set up file logging in non-production
if (process.env.NODE_ENV !== "production") {
  logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function log(message, level = "INFO", ip = null) {
  if (levels[level] <= levels[logLevel]) {
    const logMessage = `${new Date().toISOString()} - ${level} - ${
      ip ? `IP: ${ip} - ` : ""
    }${message}`;

    if (process.env.NODE_ENV === "production") {
      // ✅ On Vercel, use console logging
      console.log(logMessage);
    } else {
      // Local: write to log files + console
      const fileName = level === "ERROR" ? "error.log" : "success.log";
      const logFilePath = path.join(logsDir, fileName);
      fs.appendFileSync(logFilePath, logMessage + "\n");
      console.log(logMessage);
    }
  }
}

module.exports = log;
