const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const SUBS_FILE = path.join(__dirname, "..", "push_subscriptions.json");

function readSubs() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[push] Không đọc được push_subscriptions.json:", e.message);
  }
  return [];
}

function writeSubs(list) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("[push] Không ghi được push_subscriptions.json:", e.message);
    throw e;
  }
}

/** GET /api/push/vapid-public */
router.get("/vapid-public", (req, res) => {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
  if (!publicKey) {
    return res.json({
      configured: false,
      error: "Chưa cấu hình VAPID_PUBLIC_KEY trong .env (backend).",
    });
  }
  return res.json({ configured: true, publicKey });
});

/** POST /api/push/subscribe — body: { subscription: PushSubscription JSON } */
router.post("/subscribe", (req, res) => {
  const subscription = req.body?.subscription;
  if (!subscription || typeof subscription.endpoint !== "string") {
    return res.status(400).json({ error: "Thiếu subscription.endpoint" });
  }

  try {
    const list = readSubs().filter((s) => s.endpoint !== subscription.endpoint);
    list.push(subscription);
    writeSubs(list);
    return res.status(201).json({ ok: true, stored: list.length });
  } catch {
    return res.status(500).json({ error: "Không lưu được subscription" });
  }
});

module.exports = router;
