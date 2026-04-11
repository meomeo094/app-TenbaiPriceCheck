"use strict";
/**
 * TCG card identification via Gemini Vision.
 * Env: GEMINI_API_KEY (required).
 * Model is fixed to gemini-2.0-flash — no apiVersion override (SDK default route, v1beta).
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_MODEL_ID = "gemini-2.0-flash";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

/** System + user instructions in one text block (no separate systemInstruction). */
const FULL_TEXT_PROMPT =
  "B\u1ea1n l\u00e0 chuy\u00ean gia th\u1ea9m \u0111\u1ecbnh th\u1ebb b\u00e0i TCG (Pokemon, One Piece). " +
  "H\u00e3y \u0111\u1ecdc \u1ea3nh v\u00e0 tr\u1ea3 v\u1ec1 JSON g\u1ed3m: name (t\u00ean th\u1ebb), card_number (m\u00e3 s\u1ed1 v\u00ed d\u1ee5 001/100), " +
  "set_name (t\u00ean b\u1ed9), v\u00e0 centering_estimate (\u0111\u00e1nh gi\u00e1 \u0111\u1ed9 c\u00e2n \u0111\u1ed1i vi\u1ec1n).\n\n" +
  "Return ONLY one valid JSON object (no markdown, no extra text) with keys: " +
  "name, card_number, set_name, centering_estimate. Use null for unknown values.";

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
      mimeType: dataUrl[1].split(";")[0].trim() || "image/jpeg",
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
    name: obj.name != null ? String(obj.name) : null,
    card_number: obj.card_number != null ? String(obj.card_number) : null,
    set_name: obj.set_name != null ? String(obj.set_name) : null,
    centering_estimate: obj.centering_estimate != null ? String(obj.centering_estimate) : null,
  };
}

/**
 * @param {string} base64Image
 * @param {string} [mimeType]
 */
async function identifyCardFromImage(base64Image, mimeType) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[Gemini] GEMINI_API_KEY is not set in backend/.env");
    throw new Error("GEMINI_API_KEY is not set in backend/.env");
  }

  const { data, mimeType: mime } = parseBase64Input(base64Image, mimeType);
  if (!data || data.length < 32) {
    throw new Error("identifyCardFromImage: image payload too short or invalid.");
  }
  if (data.length > 2 * 1024 * 1024) {
    console.warn(
      "[Gemini] Large base64 (~" + (data.length / (1024 * 1024)).toFixed(2) + " MB) — consider resizing."
    );
  }

  console.log("[Gemini] model:", GEMINI_MODEL_ID);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_ID });

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent([
        { text: FULL_TEXT_PROMPT },
        { inlineData: { mimeType: mime, data } },
      ]);
      const raw = result.response.text();
      try {
        return parseJsonResponse(raw);
      } catch {
        console.error("[Gemini] Invalid JSON from model:", raw.slice(0, 500));
        throw new Error("Gemini response was not valid JSON.");
      }
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err)) {
        console.error("[Gemini] Error:", err instanceof Error ? err.message : err);
        throw err;
      }
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("GEMINI_RATE_LIMIT_EXHAUSTED");
      }
      console.log("[Gemini] Rate limit — waiting 5s, retry " + attempt + "/" + MAX_ATTEMPTS);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function recognizeCardFromImage(imageBuffer, mimeType = "image/jpeg") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("recognizeCardFromImage: invalid imageBuffer.");
  }
  return identifyCardFromImage(imageBuffer.toString("base64"), mimeType);
}

module.exports = {
  GEMINI_MODEL_ID,
  identifyCardFromImage,
  recognizeCardFromImage,
};
