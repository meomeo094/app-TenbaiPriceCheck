const express = require("express");
const {
  identifyCardFromImage,
  getGeminiModelId,
} = require("../services/geminiService");

const router = express.Router();

/** GET /api/tcg/gemini */
router.get("/gemini", (_req, res) => {
  const hasKey = Boolean((process.env.GEMINI_API_KEY || "").trim());
  res.json({
    ok: true,
    model: getGeminiModelId(),
    configured: hasKey,
    message: hasKey
      ? "POST /api/tcg/gemini ho\u1eb7c /api/tcg/identify — g\u1eedi { imageBase64, mimeType? }"
      : "Set GEMINI_API_KEY in backend/.env to enable identify.",
  });
});

/**
 * POST /api/tcg/gemini — c\u00f9ng logic v\u1edbi /identify (Gemini ph\u00e2n t\u00edch \u1ea3nh).
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post("/gemini", async (req, res) => {
  try {
    console.log("-> POST /api/tcg/gemini ", new Date().toISOString());
    const imageBase64 = req.body?.imageBase64;
    const mimeType = req.body?.mimeType;

    if (imageBase64 == null || typeof imageBase64 !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Thieu imageBase64 (base64 hoac data URL).",
      });
    }

    const parsed = await identifyCardFromImage(imageBase64, mimeType);
    res.json({ ok: true, ...parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[tcg/gemini]", msg);
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/tcg/identify
 * Body: { imageBase64: string, mimeType?: string }
 * JSON body limit: 50mb (express.json in server.js).
 */
router.post("/identify", async (req, res) => {
  try {
    console.log("-> Nh\u1eadn y\u00eau c\u1ea7u ph\u00e2n t\u00edch \u1ea3nh: ", new Date().toISOString());
    const imageBase64 = req.body?.imageBase64;
    const mimeType = req.body?.mimeType;

    if (imageBase64 == null || typeof imageBase64 !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Thieu imageBase64 (base64 hoac data URL).",
      });
    }

    const parsed = await identifyCardFromImage(imageBase64, mimeType);
    res.json({ ok: true, ...parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[tcg/identify]", msg);
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

module.exports = router;
