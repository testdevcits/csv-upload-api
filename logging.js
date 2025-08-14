const fs = require("fs");
const path = require("path");

const logLevel = process.env.LOG_LEVEL || "INFO";
const levels = { ERROR: 0, INFO: 1 };

// Only create log directory if NOT in production
let logsDir;
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

    // In production → just print to console
    if (process.env.NODE_ENV === "production") {
      if (level === "ERROR") {
        console.error(logMessage);
      } else {
        console.log(logMessage);
      }
      return;
    }

    // In dev → also log to file
    const fileName = level === "ERROR" ? "error.log" : "success.log";
    const logFilePath = path.join(logsDir, fileName);
    try {
      fs.appendFileSync(logFilePath, logMessage + "\n");
    } catch (err) {
      console.error("Logging failed:", err.message);
    }

    console.log(logMessage);
  }
}

module.exports = log;
