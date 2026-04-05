const express = require("express");
const webpush = require("web-push");
const { chromium } = require("playwright-extra");
const { getSupabase } = require("../lib/supabase");
const pushService = require("../services/pushService");

const router = express.Router();

/**
 * GET /api/diagnostics — chỉ trạng thái, không trả về chuỗi khóa bí mật.
 */
router.get("/", async (req, res, next) => {
  try {
    const out = {
      ok: true,
      timestamp: new Date().toISOString(),
      supabase: { ok: false, detail: "Chưa kiểm tra" },
      vapid: { ok: false, detail: "Chưa kiểm tra" },
      playwright: { ok: false, detail: "Chưa kiểm tra" },
    };

    try {
      const supabase = getSupabase();
      if (!supabase) {
        out.supabase = { ok: false, detail: "Thiếu cấu hình Supabase" };
      } else {
        const { error } = await supabase.from("price_monitors").select("id").limit(1);
        if (error) {
          out.supabase = { ok: false, detail: "Truy vấn price_monitors thất bại" };
        } else {
          out.supabase = { ok: true, detail: "Success" };
        }
      }
    } catch {
      out.supabase = { ok: false, detail: "Lỗi kiểm tra Supabase" };
    }

    const pub = Boolean((process.env.VAPID_PUBLIC_KEY || "").trim());
    const priv = Boolean((process.env.VAPID_PRIVATE_KEY || "").trim());
    out.vapid = {
      ok: pub && priv,
      detail: pub && priv ? "Success" : "Thiếu VAPID (public/private)",
    };

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();
      await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 15000 });
      out.playwright = { ok: true, detail: "Success" };
      await page.close();
    } catch {
      out.playwright = { ok: false, detail: "Không khởi chạy hoặc mở trang trắng được" };
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
      }
    }

    out.ok = out.supabase.ok && out.vapid.ok && out.playwright.ok;
    return res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/diagnostics/test-push — gửi một tin test tới mọi subscription đã lưu.
 */
router.post("/test-push", async (req, res, next) => {
  try {
    if (!pushService.configureWebPush()) {
      return res.status(503).json({
        ok: false,
        detail: "VAPID chưa cấu hình đủ trên server",
        sent: 0,
        failed: 0,
      });
    }

    const subs = await pushService.listSubscriptionsForWebPush();
    if (!subs.length) {
      return res.status(400).json({
        ok: false,
        detail: "Chưa có subscription nào (bật thông báo trên app trước)",
        sent: 0,
        failed: 0,
      });
    }
    const payload = JSON.stringify({
      title: "PriceCheck",
      body: "Test thành công",
      url: "/",
    });

    let sent = 0;
    let failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 120 });
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error("[diagnostics] test-push một endpoint lỗi:", e.message || e);
      }
    }

    return res.json({
      ok: sent > 0,
      detail: sent > 0 ? "Đã gửi" : "Không gửi được tới endpoint nào",
      sent,
      failed,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
