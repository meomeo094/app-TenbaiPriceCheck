const express = require("express");
const pushService = require("../services/pushService");

const router = express.Router();

function sendVapidPublic(req, res) {
  try {
    return res.json(pushService.getPublicVapidJsonResponse());
  } catch (e) {
    return res.status(500).json({ error: "Lỗi VAPID", detail: String(e.message) });
  }
}

/** GET /api/push/vapid-public */
router.get("/vapid-public", sendVapidPublic);

/** GET /api/push/vapid-public-key — cùng payload JSON cho Frontend */
router.get("/vapid-public-key", sendVapidPublic);

async function handleSubscribe(req, res) {
  try {
    const subscription = req.body?.subscription;
    if (!subscription || typeof subscription.endpoint !== "string") {
      return res.status(400).json({ error: "Thiếu subscription.endpoint" });
    }

    const result = await pushService.saveSubscription(subscription);
    let count = 0;
    try {
      const all = await pushService.listSubscriptionsForWebPush();
      count = all.length;
    } catch {
      count = 0;
    }

    return res.status(201).json({
      ok: true,
      stored: count,
      storage: result.storage,
    });
  } catch (e) {
    console.error("[push] subscribe:", e.message);
    return res.status(500).json({ error: "Không lưu được subscription" });
  }
}

/** POST /api/push/subscribe */
router.post("/subscribe", handleSubscribe);

module.exports = router;
module.exports.handleSubscribe = handleSubscribe;
