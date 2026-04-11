/**
 * Quick test: POST /api/tcg/identify with a local image file.
 * Requires: backend running on PORT (default 3001), GEMINI_API_KEY in .env
 *
 *   node backend/scripts/quick-test-tcg-identify.cjs path/to/card.jpg
 */
"use strict";

const fs = require("fs");
const path = require("path");

const port = process.env.PORT || "3001";
const url = `http://127.0.0.1:${port}/api/tcg/identify`;
const imgPath = process.argv[2];

if (!imgPath || !fs.existsSync(imgPath)) {
  console.error("Usage: node backend/scripts/quick-test-tcg-identify.cjs <image.jpg|png>");
  process.exit(1);
}

const ext = path.extname(imgPath).toLowerCase();
const mime = ext === ".png" ? "image/png" : "image/jpeg";
const b64 = fs.readFileSync(imgPath).toString("base64");
const imageBase64 = `data:${mime};base64,${b64}`;

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  body: JSON.stringify({ imageBase64 }),
})
  .then(async (r) => {
    const text = await r.text();
    console.log("HTTP", r.status);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
    if (!r.ok) process.exit(1);
  })
  .catch((e) => {
    console.error("Request failed:", e.message);
    process.exit(1);
  });
