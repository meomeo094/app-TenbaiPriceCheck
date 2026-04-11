"use strict";
/**
 * TCG card identification via Gemini Vision.
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default "gemini-1.5-flash").
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = (() => {
  const env = (process.env.GEMINI_MODEL || "").trim().replace(/\s+/g, "");
  return env || "gemini-1.5-flash";
})();

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const SYSTEM_INSTRUCTION =
  "Bạn là chuyên gia thẩm định thẻ bài TCG (Pokemon, One Piece). " +
  "Hãy đọc ảnh và trả về JSON gồm: name (tên thẻ), card_number (mã số ví dụ 001/100), " +
  "set_name (tên bộ), và centering_estimate (đánh giá độ cân đối viền).";

const USER_PROMPT =
  "Return ONLY one valid JSON object (no markdown, no extra text) with keys: " +
  "name, card_number, set_name, centering_estimate. Use null for unknown values.";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isRateLimitError(err) {
  if (!err || typeof err !== "object") return false;
  const o = /** @type {any} */ (err);
  if (o.status === 429 || o.code === 429) return true;
  if (/429|Too Many Requests|RESOURCE_EXHAUSTED|quota/i.test(String(o.message ?? ""))) return true;
  return o.cause ? isRateLimitError(o.cause) : false;
}

/**
 * @param {string} base64Image
 * @param {string} [mimeTypeHint]
 * @returns {{ data: string; mimeType: string }}
 */
function parseBase64Input(base64Image, mimeTypeHint) {
  const raw = String(base64Image ?? "").trim();
  if (!raw) throw new Error("Missing imageBase64 input.");

  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/is);
  if (dataUrl) {
    return {
      mimeType: (dataUrl[1].split(";")[0].trim() || "image/jpeg"),
      data: dataUrl[2].replace(/\s/g, ""),
    };
  }
  return {
    mimeType: (mimeTypeHint && String(mimeTypeHint).trim()) || "image/jpeg",
    data: raw.replace(/\s/g, ""),
  };
}

/** @param {string} text */
function parseJsonResponse(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const obj = JSON.parse(s);
  return {
    name:               obj.name               != null ? String(obj.name)               : null,
    card_number:        obj.card_number        != null ? String(obj.card_number)        : null,
    set_name:           obj.set_name           != null ? String(obj.set_name)           : null,
    centering_estimate: obj.centering_estimate != null ? String(obj.centering_estimate) : null,
  };
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * @param {string} base64Image   raw base64 or data-URL
 * @param {string} [mimeType]
 */
async function identifyCardFromImage(base64Image, mimeType) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("================================================================");
    console.error("[Gemini] GEMINI_API_KEY is not set in backend/.env");
    console.error("================================================================");
    throw new Error("GEMINI_API_KEY is not set in backend/.env");
  }

  const { data, mimeType: mime } = parseBase64Input(base64Image, mimeType);
  if (!data || data.length < 32) {
    throw new Error("identifyCardFromImage: image payload too short or invalid.");
  }
  if (data.length > 2 * 1024 * 1024) {
    console.warn(
      "[Gemini] Base64 payload is large (~" +
        (data.length / (1024 * 1024)).toFixed(2) +
        " MB) — consider resizing to save tokens."
    );
  }

  const modelId = DEFAULT_MODEL;
  console.log("[Gemini] Đang gọi Gemini với model:", modelId);
  console.log("[Gemini] Đang phân tích ảnh...");

  // Initialise SDK with no apiVersion override — SDK routes automatically
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent([
        { text: USER_PROMPT },
        { inlineData: { mimeType: mime, data } },
      ]);

      const raw = result.response.text();
      try {
        return parseJsonResponse(raw);
      } catch {
        console.error("[Gemini] Response not valid JSON:", raw.slice(0, 500));
        throw new Error("Gemini response was not valid JSON.");
      }
    } catch (err) {
      lastErr = err;

      if (!isRateLimitError(err)) {
        // Log full error so we can see the real Google message
        console.error("[Gemini] Error on attempt", attempt + "/" + MAX_ATTEMPTS + ":");
        console.error(err instanceof Error ? err.message : err);
        throw err;
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new Error("GEMINI_RATE_LIMIT_EXHAUSTED");
      }
      console.log(`[Gemini] Hết lượt, đang đợi 5 giây để thử lại lần ${attempt}....`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** @param {Buffer} imageBuffer */
async function recognizeCardFromImage(imageBuffer, mimeType = "image/jpeg") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("recognizeCardFromImage: invalid imageBuffer.");
  }
  return identifyCardFromImage(imageBuffer.toString("base64"), mimeType);
}

module.exports = {
  DEFAULT_MODEL,
  identifyCardFromImage,
  recognizeCardFromImage,
};
