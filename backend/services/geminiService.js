/**
 * TCG card identification via Gemini (base64 image).
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional).
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

/** Default avoids bare "gemini-1.5-flash" 404 on some API tiers; override with GEMINI_MODEL. */
const FALLBACK_MODEL_ID = "gemini-1.5-flash-latest";

/**
 * @returns {string} Model id without stray whitespace.
 */
function getGeminiModelId() {
  const fromEnv = (process.env.GEMINI_MODEL || "").trim().replace(/\s+/g, "");
  return fromEnv || FALLBACK_MODEL_ID;
}

const DEFAULT_MODEL = getGeminiModelId();

const SYSTEM_INSTRUCTION = [
  "B\u1ea1n l\u00e0 chuy\u00ean gia th\u1ea9m \u0111\u1ecbnh th\u1ebb b\u00e0i TCG (Pokemon, One Piece).",
  "H\u00e3y \u0111\u1ecdc \u1ea3nh v\u00e0 tr\u1ea3 v\u1ec1 JSON g\u1ed3m: name (t\u00ean th\u1ebb), card_number (m\u00e3 s\u1ed1 v\u00ed d\u1ee5 001/100), set_name (t\u00ean b\u1ed9), v\u00e0 centering_estimate (\u0111\u00e1nh gi\u00e1 \u0111\u1ed9 c\u00e2n \u0111\u1ed1i vi\u1ec1n).",
].join(" ");

/**
 * @param {string} base64Image
 * @param {string} [mimeTypeHint]
 * @returns {{ data: string, mimeType: string }}
 */
function normalizeBase64Input(base64Image, mimeTypeHint) {
  const raw = String(base64Image ?? "").trim();
  if (!raw) {
    throw new Error("identifyCardFromImage: missing base64 image data.");
  }

  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/is);
  if (dataUrl) {
    return {
      mimeType: dataUrl[1].split(";")[0].trim() || "image/jpeg",
      data: dataUrl[2].replace(/\s/g, ""),
    };
  }

  const mime = (mimeTypeHint && String(mimeTypeHint).trim()) || "image/jpeg";
  return { mimeType: mime, data: raw.replace(/\s/g, "") };
}

/**
 * @param {string} text
 */
function parseModelJson(text) {
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const obj = JSON.parse(s);
  return {
    name: obj.name != null ? String(obj.name) : null,
    card_number: obj.card_number != null ? String(obj.card_number) : null,
    set_name: obj.set_name != null ? String(obj.set_name) : null,
    centering_estimate:
      obj.centering_estimate != null ? String(obj.centering_estimate) : null,
  };
}

/**
 * @param {string} base64Image — raw base64 or data URL
 * @param {string} [mimeType]
 * @returns {Promise<{ name: string | null, card_number: string | null, set_name: string | null, centering_estimate: string | null }>}
 */
async function identifyCardFromImage(base64Image, mimeType) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("");
    console.error("================================================================");
    console.error("[Gemini] ERROR: Missing GEMINI_API_KEY in backend/.env");
    console.error("[Gemini] LOI: Thieu GEMINI_API_KEY trong backend/.env — them khoa API.");
    console.error("        Add your API key from Google AI Studio / Cloud Console.");
    console.error("================================================================");
    console.error("");
    throw new Error("GEMINI_API_KEY is not set in backend/.env");
  }

  const { data, mimeType: mime } = normalizeBase64Input(base64Image, mimeType);
  if (!data || data.length < 32) {
    throw new Error("identifyCardFromImage: image payload too short or invalid.");
  }

  const modelName = getGeminiModelId();
  console.log("\u0110ang g\u1ecdi Gemini v\u1edbi model:", modelName);
  console.log("[Gemini] \u0110ang ph\u00E2n t\u00EDch \u1EA3nh...");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const userPrompt =
    "Return ONLY one valid JSON object (no markdown, no extra text) with keys: name, card_number, set_name, centering_estimate. Use null for unknown values.";

  const result = await model.generateContent([
    { text: userPrompt },
    {
      inlineData: {
        mimeType: mime,
        data,
      },
    },
  ]);

  const text = result.response.text();
  try {
    return parseModelJson(text);
  } catch (e) {
    console.error("[Gemini] Could not parse JSON from model:", text.slice(0, 500));
    throw new Error(
      `Gemini response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

async function recognizeCardFromImage(imageBuffer, mimeType = "image/jpeg") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("recognizeCardFromImage: invalid imageBuffer.");
  }
  return identifyCardFromImage(imageBuffer.toString("base64"), mimeType);
}

module.exports = {
  DEFAULT_MODEL,
  getGeminiModelId,
  FALLBACK_MODEL_ID,
  identifyCardFromImage,
  recognizeCardFromImage,
};
