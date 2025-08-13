const fs = require("fs");
const path = require("path");

const logLevel = process.env.LOG_LEVEL || "INFO";
const levels = { ERROR: 0, INFO: 1 };

function log(message, level = "INFO", ip = null) {
  if (levels[level] <= levels[logLevel]) {
    const logMessage = `${new Date().toISOString()} - ${level} - ${
      ip ? `IP: ${ip} - ` : ""
    }${message}\n`;

    // Separate files for error and success
    const fileName = level === "ERROR" ? "error.log" : "success.log";
    const logFilePath = path.join(__dirname, "logs", fileName);

    fs.appendFileSync(logFilePath, logMessage);
    console.log(logMessage.trim());
  }
}

module.exports = log;
