/**
 * TCG card identification via Gemini (base64 image).
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional).
 * Uses stable API v1 only (no v1beta). SDK default is v1beta if omitted; we set apiVersion "v1".
 * v1 generateContent does not accept systemInstruction in the body — inline it in the text prompt.
 */
const {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} = require("@google/generative-ai");

/** Default model id (trimmed; no stray spaces). Override with GEMINI_MODEL. */
const FALLBACK_MODEL_ID = "gemini-1.5-flash";

/** Second try on v1 if primary returns404 (e.g. alias availability). */
const MODEL_FALLBACK_404_ID = "gemini-1.5-flash-latest";

const GEMINI_REQUEST_OPTIONS = { apiVersion: "v1" };

/** Log when base64 payload is large (rough token / quota pressure). */
const LARGE_IMAGE_BASE64_CHARS = 2 * 1024 * 1024;

const MAX_GEMINI_ATTEMPTS = 3;
const RATE_LIMIT_RETRY_WAIT_MS = 5000;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isRateLimitError(err) {
  if (err == null || typeof err !== "object") return false;
  const o = /** @type {{ status?: number; code?: number; message?: string; cause?: unknown }} */ (err);
  if (o.status === 429 || o.code === 429) return true;
  const msg = String(o.message ?? err);
  if (/429|Too Many Requests|RESOURCE_EXHAUSTED|quota/i.test(msg)) return true;
  if (o.cause) return isRateLimitError(o.cause);
  return false;
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isModelNotFoundError(err) {
  if (err instanceof GoogleGenerativeAIFetchError && err.status === 404) return true;
  if (err == null || typeof err !== "object") return false;
  const o = /** @type {{ status?: number; code?: number; message?: string; cause?: unknown }} */ (err);
  if (o.status === 404 || o.code === 404) return true;
  const msg = String(o.message ?? err);
  if (/404|\bnot\s+found\b|NOT_FOUND|was not found|is not found/i.test(msg)) return true;
  if (o.cause) return isModelNotFoundError(o.cause);
  return false;
}

/**
 * @param {string} label
 * @param {unknown} err
 * @param {number} [depth]
 */
function logGeminiError(label, err, depth = 0) {
  if (depth > 2) return;
  console.error("[Gemini]", label);
  if (err instanceof GoogleGenerativeAIFetchError) {
    console.error("[Gemini] GoogleGenerativeAIFetchError status:", err.status, err.statusText);
    console.error("[Gemini] GoogleGenerativeAIFetchError message:", err.message);
    if (err.errorDetails != null) {
      try {
        console.error("[Gemini] errorDetails:", JSON.stringify(err.errorDetails, null, 2));
      } catch {
        console.error("[Gemini] errorDetails:", err.errorDetails);
      }
    }
  } else if (err instanceof Error) {
    console.error("[Gemini] Error name:", err.name);
    console.error("[Gemini] Error message:", err.message);
    if (err.stack) {
      console.error("[Gemini] Stack (top):\n", err.stack.split("\n").slice(0, 14).join("\n"));
    }
  } else {
    console.error("[Gemini] Non-Error value:", err);
  }
  if (err && typeof err === "object" && "cause" in err && err.cause != null) {
    console.error("[Gemini] nested cause:");
    logGeminiError("(cause)", err.cause, depth + 1);
  }
}

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
 * @param {GoogleGenerativeAI} genAI
 * @param {string} modelId
 * @param {string} mime
 * @param {string} data
 */
async function generateIdentifyWithModel(genAI, modelId, mime, data) {
  const model = genAI.getGenerativeModel({ model: modelId }, GEMINI_REQUEST_OPTIONS);

  const userPrompt =
    "Return ONLY one valid JSON object (no markdown, no extra text) with keys: name, card_number, set_name, centering_estimate. Use null for unknown values.";

  const fullTextPrompt = SYSTEM_INSTRUCTION + "\n\n" + userPrompt;

  let lastErr = /** @type {unknown} */ (undefined);
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(
        [
          { text: fullTextPrompt },
          {
            inlineData: {
              mimeType: mime,
              data,
            },
          },
        ],
        GEMINI_REQUEST_OPTIONS
      );

      const text = result.response.text();
      try {
        return parseModelJson(text);
      } catch (e) {
        console.error("[Gemini] Could not parse JSON from model:", text.slice(0, 500));
        throw new Error(
          `Gemini response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } catch (e) {
      lastErr = e;
      if (isModelNotFoundError(e)) {
        throw e;
      }
      if (!isRateLimitError(e)) {
        logGeminiError(`generateContent failed (model=${modelId}, attempt=${attempt})`, e);
        throw e;
      }
      if (attempt === MAX_GEMINI_ATTEMPTS) {
        console.error("[Gemini] Rate limit sau " + MAX_GEMINI_ATTEMPTS + " lan goi.");
        throw new Error("GEMINI_RATE_LIMIT_EXHAUSTED");
      }
      console.log(
        "[Gemini] H\u1ebft l\u01b0\u1ee3t, \u0111ang \u0111\u1ee3i 5 gi\u00e2y \u0111\u1ec3 th\u1eed l\u1ea1i l\u1ea7n " +
          attempt +
          "...."
      );
      await sleep(RATE_LIMIT_RETRY_WAIT_MS);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function identifyCardFromImage(base64Image, mimeType) {
  if (!(process.env.GEMINI_API_KEY || "").trim()) {
    console.error("");
    console.error("================================================================");
    console.error("[Gemini] ERROR: Missing GEMINI_API_KEY in backend/.env");
    console.error("[Gemini] LOI: Thieu GEMINI_API_KEY trong backend/.env — them khoa API.");
    console.error("        Add your API key from Google AI Studio / Cloud Console.");
    console.error("================================================================");
    console.error("");
    throw new Error("GEMINI_API_KEY is not set in backend/.env");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const { data, mimeType: mime } = normalizeBase64Input(base64Image, mimeType);
  if (!data || data.length < 32) {
    throw new Error("identifyCardFromImage: image payload too short or invalid.");
  }

  if (data.length > LARGE_IMAGE_BASE64_CHARS) {
    console.warn(
      "[Gemini] Anh base64 rat lon (~" +
        (data.length / (1024 * 1024)).toFixed(2) +
        " MB chuoi) — de ton token, nen giam kich thuoc truoc khi gui."
    );
  }

  const primaryModelId = getGeminiModelId();
  console.log("[Gemini] API requestOptions.apiVersion:", GEMINI_REQUEST_OPTIONS.apiVersion);
  console.log("\u0110ang g\u1ecdi Gemini v\u1edbi model:", primaryModelId);
  console.log("[Gemini] \u0110ang ph\u00E2n t\u00EDch \u1EA3nh...");

  try {
    return await generateIdentifyWithModel(genAI, primaryModelId, mime, data);
  } catch (e) {
    if (!isModelNotFoundError(e)) {
      throw e;
    }

    if (primaryModelId !== MODEL_FALLBACK_404_ID) {
      logGeminiError(
        `Model not found on v1 (${primaryModelId}) — retrying ${MODEL_FALLBACK_404_ID} on v1`,
        e
      );
      console.error("[Gemini] Fallback model (v1):", MODEL_FALLBACK_404_ID);
      try {
        return await generateIdentifyWithModel(genAI, MODEL_FALLBACK_404_ID, mime, data);
      } catch (e2) {
        logGeminiError(`Fallback model ${MODEL_FALLBACK_404_ID} on v1 failed`, e2);
        throw e2;
      }
    }

    logGeminiError(`Model not found on v1 (${primaryModelId})`, e);
    throw e;
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
  MODEL_FALLBACK_404_ID,
  GEMINI_REQUEST_OPTIONS,
  identifyCardFromImage,
  recognizeCardFromImage,
};
