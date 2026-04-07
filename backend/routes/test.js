const express = require("express");
const { chromium } = require("playwright-extra");

const router = express.Router();

/**
 * GET /api/diagnostics — Playwright có khởi chạy được không.
 */
router.get("/", async (req, res, next) => {
  try {
    const out = {
      ok: true,
      timestamp: new Date().toISOString(),
      playwright: { ok: false, detail: "Chưa kiểm tra" },
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

    out.ok = out.playwright.ok;
    return res.json(out);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
