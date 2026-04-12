"use strict";
/**
 * TCG card identification via Gemini Vision.
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional; default gemini-2.5-flash).
 * Do not pass apiVersion — let @google/generative-ai choose the default route.
 */
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * @returns {string}
 */
function getGeminiModelId() {
  const fromEnv = (process.env.GEMINI_MODEL || "").trim().replace(/\s+/g, "");
  return fromEnv || DEFAULT_GEMINI_MODEL;
}

/** Vietnamese prompt with diacritics; loaded from UTF-8 file (no \\u escapes in model text). */
function loadIdentifyPrompt() {
  const p = path.join(__dirname, "tcgIdentifyPrompt.vi.txt");
  return fs.readFileSync(p, "utf8").trim();
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

/** @param {unknown} n */
function toFiniteNumber(n) {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "") {
    const x = parseFloat(n.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

/** @param {string} s */
function parseSlashPair(s) {
  const m = String(s).trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const a = parseFloat(m[1].replace(",", "."));
  const b = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}

/**
 * @param {unknown} raw
 * @param {'lr'|'tb'} kind
 * @returns {{ left?: number; right?: number; top?: number; bottom?: number } | null}
 */
function normalizeCenteringAxis(raw, kind) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const p = parseSlashPair(raw);
    if (!p) return null;
    if (kind === "lr") return { left: p.a, right: p.b };
    return { top: p.a, bottom: p.b };
  }
  if (typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (kind === "lr") {
    const left = toFiniteNumber(o.left ?? o.Left ?? o.trai);
    const right = toFiniteNumber(o.right ?? o.Right ?? o.phai);
    if (left == null || right == null) return null;
    return { left, right };
  }
  const top = toFiniteNumber(o.top ?? o.Top ?? o.tren);
  const bottom = toFiniteNumber(o.bottom ?? o.Bottom ?? o.duoi);
  if (top == null || bottom == null) return null;
  return { top, bottom };
}

/** @param {string} text */
function parseJsonResponse(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const obj = JSON.parse(s);

  const lr = normalizeCenteringAxis(obj.centering_lr, "lr");
  const tb = normalizeCenteringAxis(obj.centering_tb, "tb");

  return {
    name: obj.name != null ? String(obj.name) : null,
    card_number: obj.card_number != null ? String(obj.card_number) : null,
    set_name: obj.set_name != null ? String(obj.set_name) : null,
    centering_lr: lr,
    centering_tb: tb,
    centering_estimate: obj.centering_estimate != null ? String(obj.centering_estimate) : null,
    psa_prediction: obj.psa_prediction != null ? String(obj.psa_prediction) : null,
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

  const modelId = getGeminiModelId();
  console.log("[Gemini] model:", modelId);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const result = await model.generateContent([
    { text: loadIdentifyPrompt() },
    { inlineData: { mimeType: mime, data } },
  ]);
  const raw = result.response.text();
  try {
    return parseJsonResponse(raw);
  } catch {
    console.error("[Gemini] Invalid JSON from model:", raw.slice(0, 500));
    throw new Error("Gemini response was not valid JSON.");
  }
}

async function recognizeCardFromImage(imageBuffer, mimeType = "image/jpeg") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("recognizeCardFromImage: invalid imageBuffer.");
  }
  return identifyCardFromImage(imageBuffer.toString("base64"), mimeType);
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  getGeminiModelId,
  identifyCardFromImage,
  recognizeCardFromImage,
};
