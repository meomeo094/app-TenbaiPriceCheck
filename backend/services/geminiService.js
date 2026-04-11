/**
 * TCG AI — skeleton for Gemini 1.5 Flash: recognize card name and product code from a photo.
 *
 * Configure later: GEMINI_API_KEY in backend/.env
 *
 * REST reference:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY
 * Body: { contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: "..." }] }] }
 *
 * Stub only — implement request/parse when API key and prompts are ready.
 */

const DEFAULT_MODEL = "gemini-1.5-flash";

/**
 * @param {Buffer} imageBuffer raw image (JPEG/PNG)
 * @param {string} [mimeType] e.g. image/jpeg, image/png
 * @returns {Promise<{ cardName: string | null, productCode: string | null, rawText?: string }>}
 */
async function recognizeCardFromImage(imageBuffer, mimeType = "image/jpeg") {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set in backend/.env — cannot call Gemini 1.5 Flash."
    );
  }
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("recognizeCardFromImage: invalid imageBuffer.");
  }

  // TODO: base64, fetch generateContent, parse JSON for card name + code
  void mimeType;
  void key;
  throw new Error(
    "recognizeCardFromImage: not implemented yet — add prompt and response parsing."
  );
}

module.exports = {
  DEFAULT_MODEL,
  recognizeCardFromImage,
};
