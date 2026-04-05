/**
 * Cron quét price_monitors: Playwright + stealth lấy giá, cập nhật Supabase, Web Push khi đạt target.
 */

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const webpush = require("web-push");
const { chromium } = require("playwright-extra");
const { getSupabaseForJobs } = require("../lib/supabase");
/* Stealth đã bật trong server.js (playwright-extra dùng chung). */

const SUBS_FILE = path.join(__dirname, "..", "push_subscriptions.json");
const GOTO_TIMEOUT_MS = 45_000;
const CRON_EXPR = "* * * * *"; // mỗi phút — lọc due theo interval_min trong DB

let scanRunning = false;

function readSubscriptions() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
      return Array.isArray(raw) ? raw : [];
    }
  } catch (e) {
    console.error("[priceScanner] Đọc push_subscriptions.json lỗi:", e.message);
  }
  return [];
}

function writeSubscriptions(list) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("[priceScanner] Ghi push_subscriptions.json lỗi:", e.message);
  }
}

/**
 * Heuristic lấy một số giá (JPY) từ trang sản phẩm — chạy trong browser.
 * @returns {number|null}
 */
function extractPriceEvaluate() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const j = JSON.parse(s.textContent || "{}");
        const items = Array.isArray(j) ? j : [j];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const type = item["@type"];
          const types = Array.isArray(type) ? type : type ? [type] : [];
          if (!types.includes("Product") && !types.some((t) => String(t).includes("Product"))) continue;
          const offers = item.offers;
          const o = Array.isArray(offers) ? offers[0] : offers;
          if (o && typeof o === "object") {
            const p = o.price ?? o.lowPrice ?? o.highPrice;
            if (p != null) {
              const n = parseFloat(String(p).replace(/,/g, ""));
              if (Number.isFinite(n) && n >= 0) return Math.round(n);
            }
          }
        }
      } catch {
        /* ignore malformed JSON-LD */
      }
    }

    const metaSelectors = [
      'meta[itemprop="price"]',
      'meta[property="product:price:amount"]',
      'meta[name="twitter:data1"]',
    ];
    for (const sel of metaSelectors) {
      const m = document.querySelector(sel);
      const c = m && m.getAttribute("content");
      if (c) {
        const n = parseFloat(String(c).replace(/,/g, ""));
        if (Number.isFinite(n) && n >= 0) return Math.round(n);
      }
    }

    const withDataPrice = document.querySelector(
      "[data-price], [data-product-price], [itemprop=price]"
    );
    if (withDataPrice) {
      const v =
        withDataPrice.getAttribute("data-price") ||
        withDataPrice.getAttribute("data-product-price") ||
        withDataPrice.getAttribute("content") ||
        withDataPrice.textContent;
      if (v) {
        const digits = String(v).replace(/[^\d]/g, "");
        if (digits) {
          const n = parseInt(digits, 10);
          if (Number.isFinite(n) && n >= 0) return n;
        }
      }
    }

    const bodyText = document.body ? document.body.innerText : "";
    const patterns = [
      /[¥￥]\s*([\d,]+)/,
      /([\d,]+)\s*円/,
      /価格[：:]\s*([\d,]+)/,
      /買取[：:]\s*[¥￥]?\s*([\d,]+)/,
    ];
    for (const re of patterns) {
      const m = bodyText.match(re);
      if (m && m[1]) {
        const n = parseInt(m[1].replace(/,/g, ""), 10);
        if (Number.isFinite(n) && n > 0 && n < 1e9) return n;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} productUrl
 * @returns {Promise<number|null>}
 */
async function scrapeCurrentPrice(page, productUrl) {
  await page.goto(productUrl, {
    waitUntil: "domcontentloaded",
    timeout: GOTO_TIMEOUT_MS,
  });
  await page.waitForTimeout(1500);
  const price = await page.evaluate(extractPriceEvaluate);
  if (price == null || !Number.isFinite(price)) return null;
  return Math.round(Number(price));
}

function monitorIsDue(row, nowMs) {
  const intervalMin = Number(row.interval_min);
  if (!Number.isFinite(intervalMin) || intervalMin < 1) return false;
  if (!row.last_run) return true;
  const last = new Date(row.last_run).getTime();
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= intervalMin * 60 * 1000;
}

async function sendTargetPricePush(row, currentPrice) {
  const pub = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const contact = (process.env.VAPID_CONTACT_EMAIL || "mailto:admin@localhost").trim();
  if (!pub || !priv) {
    console.warn("[priceScanner] Bỏ qua Web Push: thiếu VAPID_PUBLIC_KEY hoặc VAPID_PRIVATE_KEY");
    return;
  }

  webpush.setVapidDetails(contact.startsWith("mailto:") ? contact : `mailto:${contact}`, pub, priv);

  let subs = readSubscriptions();
  if (!subs.length) {
    console.warn("[priceScanner] Không có subscription nào trong push_subscriptions.json");
    return;
  }

  const payload = JSON.stringify({
    title: "PriceCheck — đạt giá mục tiêu",
    body: `Giá hiện tại ${currentPrice.toLocaleString("ja-JP")}円 ≤ mục tiêu ${Number(row.target_price).toLocaleString("ja-JP")}円`,
    url: "/monitor",
  });

  const dead = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    try {
      await webpush.sendNotification(sub, payload, { TTL: 3600 });
    } catch (err) {
      const code = err && err.statusCode;
      console.error("[priceScanner] Push lỗi:", code || "", err.message || err);
      if (code === 404 || code === 410) dead.push(sub.endpoint);
    }
  }

  if (dead.length) {
    subs = subs.filter((s) => !dead.includes(s.endpoint));
    writeSubscriptions(subs);
  }
}

async function runScanTick() {
  if (scanRunning) return;
  scanRunning = true;

  const supabase = getSupabaseForJobs();
  if (!supabase) {
    scanRunning = false;
    return;
  }

  let browser = null;
  try {
    const { data: rows, error: listErr } = await supabase.from("price_monitors").select("*");
    if (listErr) {
      console.error("[priceScanner] Không đọc được price_monitors:", listErr.message);
      return;
    }

    const nowMs = Date.now();
    const due = (rows || []).filter((r) => monitorIsDue(r, nowMs));
    if (!due.length) return;

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--lang=ja-JP",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      viewport: { width: 390, height: 844 },
    });

    for (const row of due) {
      const page = await context.newPage();
      const nowIso = new Date().toISOString();
      let currentPrice = null;

      try {
        if (!row.product_url || typeof row.product_url !== "string") {
          throw new Error("Thiếu product_url");
        }
        currentPrice = await scrapeCurrentPrice(page, row.product_url.trim());
      } catch (e) {
        console.error(`[priceScanner] Quét lỗi id=${row.id} url=${row.product_url}:`, e.message || e);
      } finally {
        try {
          await page.close();
        } catch {
          /* ignore */
        }
      }

      try {
        const updates = { last_run: nowIso };
        if (currentPrice != null && Number.isFinite(currentPrice)) {
          updates.current_price = currentPrice;
        }
        const { error: upErr } = await supabase.from("price_monitors").update(updates).eq("id", row.id);
        if (upErr) {
          console.error(`[priceScanner] Cập nhật DB lỗi id=${row.id}:`, upErr.message);
        }
      } catch (e) {
        console.error(`[priceScanner] Cập nhật DB exception id=${row.id}:`, e.message || e);
      }

      try {
        if (
          currentPrice != null &&
          Number.isFinite(currentPrice) &&
          Number.isFinite(Number(row.target_price)) &&
          currentPrice <= Number(row.target_price)
        ) {
          await sendTargetPricePush(row, currentPrice);
        }
      } catch (e) {
        console.error("[priceScanner] Gửi push lỗi:", e.message || e);
      }
    }
  } catch (e) {
    console.error("[priceScanner] Tick lỗi:", e.message || e);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    scanRunning = false;
  }
}

function startPriceScannerJob() {
  cron.schedule(CRON_EXPR, () => {
    runScanTick().catch((e) => console.error("[priceScanner] runScanTick:", e.message || e));
  });
  console.log("[priceScanner] Đã bật cron price monitors (mỗi phút; due theo interval_min).");
  void runScanTick();
}

module.exports = { startPriceScannerJob, runScanTick };
