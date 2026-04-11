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
      ? "POST /api/tcg/identify — gửi { imageBase64, mimeType? }"
      : "Set GEMINI_API_KEY in backend/.env to enable identify.",
  });
});

/**
 * POST /api/tcg/identify
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post("/identify", async (req, res) => {
  try {
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
