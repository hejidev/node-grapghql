const path = require("path");
const fs = require("fs");

const clearImage = (filePath) => {
  if (!filePath) return;

  // ✅ FIX: go OUT of util folder
  const fullPath = path.join(__dirname, "..", filePath);

  fs.unlink(fullPath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.log("Error deleting file:", err);
    }
  });
};

exports.clearImage = clearImage;