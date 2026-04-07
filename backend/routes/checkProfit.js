const express = require("express");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-extra");

const { scrapeGameKaitori } = require("../scrapers/gamekaitori");
const { scrapeIchome } = require("../scrapers/ichome");
const { scrapeHomura } = require("../scrapers/homura");
const { scrapeMoriMori } = require("../scrapers/morimori");

const router = express.Router();

/** Cùng đường dẫn với server.js — export từ DB / bảng my_inventory (JSON). */
const INVENTORY_FILE = path.join(__dirname, "..", "my_inventory.json");

function loadInventoryFromFile() {
  if (!fs.existsSync(INVENTORY_FILE)) return null;
  try {
    const raw = fs.readFileSync(INVENTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.inventory)) return data.inventory;
    return null;
  } catch {
    return null;
  }
}

function parseKaitoriYen(result) {
  if (!result || result.status !== "success" || result.price == null) return null;
  const n = parseInt(String(result.price).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Chọn giá kaitori cao nhất trên 4 site; nếu trùng giá, ưu tiên thứ tự Wiki → 1-chome → Homura → MoriMori.
 * Profit = max_kaitori_price - purchase_price (tính sau khi có best).
 */
function pickMaxKaitori(wiki, ichome, homura, mori) {
  const ordered = [wiki, ichome, homura, mori];
  let best = null;
  for (const r of ordered) {
    const p = parseKaitoriYen(r);
    if (p == null) continue;
    if (!best || p > best.price) {
      best = { price: p, result: r };
    }
  }
  return best;
}

/**
 * POST /api/check-profit
 *
 * Body (ưu tiên): { inventory: [{ jan, purchase_price, name? }] }
 * Hoặc đọc backend/my_inventory.json nếu body không có inventory hợp lệ.
 */
router.post("/", async (req, res, next) => {
  try {
    let rows = req.body?.inventory;
    if (!Array.isArray(rows) || rows.length === 0) {
      const fromFile = loadInventoryFromFile();
      if (!fromFile || fromFile.length === 0) {
        return res.status(400).json({
          error: "Thiếu dữ liệu inventory",
          detail:
            "Gửi JSON { \"inventory\": [ { \"jan\", \"purchase_price\", \"name?\" } ] } hoặc tạo file backend/my_inventory.json (mảng hoặc { \"inventory\": [...] }).",
        });
      }
      rows = fromFile;
    }

    let browser = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1280,800",
          "--lang=ja-JP",
        ],
      });

      const results = [];

      for (const row of rows) {
        const jan = String(row.jan ?? "").trim();
        const purchaseRaw = row.purchase_price;
        const purchase =
          typeof purchaseRaw === "number" ? purchaseRaw : parseInt(String(purchaseRaw ?? ""), 10);

        if (!/^\d{8,14}$/.test(jan)) {
          results.push({
            jan,
            name: row.name ?? null,
            purchase_price: purchaseRaw ?? null,
            max_kaitori_price: null,
            max_price_site: null,
            link: null,
            profit: null,
            error: "Mã JAN không hợp lệ (8–14 chữ số)",
          });
          continue;
        }

        if (!Number.isFinite(purchase) || purchase < 0) {
          results.push({
            jan,
            name: row.name ?? null,
            purchase_price: purchaseRaw ?? null,
            max_kaitori_price: null,
            max_price_site: null,
            link: null,
            profit: null,
            error: "purchase_price không hợp lệ",
          });
          continue;
        }

        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          locale: "ja-JP",
          timezoneId: "Asia/Tokyo",
          viewport: { width: 390, height: 844 },
        });

        const [page1, page2, page3, page4] = await Promise.all([
          context.newPage(),
          context.newPage(),
          context.newPage(),
          context.newPage(),
        ]);

        const [wiki, ichome, homura, mori] = await Promise.all([
          scrapeGameKaitori(page1, jan),
          scrapeIchome(page2, jan),
          scrapeHomura(page3, jan),
          scrapeMoriMori(page4, jan),
        ]);

        await context.close();

        const best = pickMaxKaitori(wiki, ichome, homura, mori);
        const nameFromRow = row.name != null && String(row.name).trim() ? String(row.name).trim() : null;
        const nameFromScrape =
          best?.result?.name ??
          [wiki, ichome, homura, mori].find((r) => r.name)?.name ??
          null;
        const displayName = nameFromRow ?? nameFromScrape;

        if (!best) {
          results.push({
            jan,
            name: displayName,
            purchase_price: purchase,
            max_kaitori_price: null,
            max_price_site: null,
            link: null,
            profit: null,
          });
          continue;
        }

        const maxKaitori = best.price;
        const profitYen = maxKaitori - purchase;
        results.push({
          jan,
          name: displayName,
          max_kaitori_price: maxKaitori,
          max_price_site: best.result.site,
          link: best.result.link,
          purchase_price: purchase,
          profit: profitYen,
        });
      }

      return res.json({
        timestamp: new Date().toISOString(),
        results,
      });
    } catch (err) {
      return next(err);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
