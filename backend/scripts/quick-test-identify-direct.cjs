"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { identifyCardFromImage } = require("../services/geminiService");

/** 1×1 PNG */
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

(async () => {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    console.log("SKIP: no GEMINI_API_KEY");
    process.exit(0);
  }
  console.log("GEMINI_MODEL env:", process.env.GEMINI_MODEL || "(default)");
  try {
    const out = await identifyCardFromImage(PNG_B64, "image/png");
    console.log("OK:", JSON.stringify(out, null, 2));
  } catch (e) {
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
})();
