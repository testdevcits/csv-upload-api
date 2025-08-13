const fs = require("fs");
const path = require("path");

const logLevel = process.env.LOG_LEVEL || "INFO";
const levels = { ERROR: 0, INFO: 1 };

// Ensure logs folder exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message, level = "INFO", ip = null) {
  if (levels[level] <= levels[logLevel]) {
    const logMessage = `${new Date().toISOString()} - ${level} - ${
      ip ? `IP: ${ip} - ` : ""
    }${message}\n`;

    const fileName = level === "ERROR" ? "error.log" : "success.log";
    const logFilePath = path.join(logsDir, fileName);

    fs.appendFileSync(logFilePath, logMessage);
    console.log(logMessage.trim());
  }
}

module.exports = log;
