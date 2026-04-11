const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const { scrapeGameKaitori } = require("./scrapers/gamekaitori");
const { scrapeIchome } = require("./scrapers/ichome");
const { scrapeHomura } = require("./scrapers/homura");
const { scrapeMoriMori } = require("./scrapers/morimori");
const testRoutes = require("./routes/test");
const checkProfitRoutes = require("./routes/checkProfit");
const inventoryRoutes = require("./routes/inventory");
const tcgRouter = require("./routes/tcg");
const { getGeminiModelId } = require("./services/geminiService");

// Stealth Plugin — BẮT BUỘC để qua Cloudflare/anti-bot
chromium.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

// =========================================
// CORS — ĐẦU TIÊN, trước mọi middleware/route
// =========================================
app.use(
  cors({
    origin: "*",
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  })
);
// Không dùng app.options("*", cors()) — path-to-regexp mới (Express 5) báo PathError với "*".
// Middleware cors() ở trên đã tự trả OPTIONS preflight cho mọi route.

// Large JSON bodies for POST /api/tcg/identify (imageBase64) — avoid truncating base64 mid-string
app.use(express.json({ limit: "50mb" }));

app.use("/api/diagnostics", testRoutes);
app.use("/api/check-profit", checkProfitRoutes);
/** Kho hàng — cùng router, hai path (frontend dùng /api/my-inventory) */
app.use("/api/my-inventory", inventoryRoutes);
app.use("/api/inventory", inventoryRoutes);

/** TCG — POST /api/tcg/identify, GET /api/tcg/gemini */
app.use("/api/tcg", tcgRouter);

// Lưu browser instances để cleanup
const activeBrowsers = new Map();

// =========================================
// Search Stats — lưu vào search_stats.json
// =========================================
const STATS_FILE = path.join(__dirname, "search_stats.json");

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
  } catch { /* ignore */ }
}

function recordSearch(jan, productName) {
  const stats = loadStats();
  if (!stats[jan]) stats[jan] = { count: 0, name: null };
  stats[jan].count += 1;
  if (productName && !stats[jan].name) stats[jan].name = productName;
  saveStats(stats);
}

// =========================================
// Health Check — GET /
// =========================================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "PriceCheck Backend đang chạy", timestamp: new Date().toISOString() });
});

// =========================================
// Top Searches — GET /api/top-searches
// =========================================
app.get("/api/top-searches", (req, res) => {
  const stats = loadStats();
  const top = Object.entries(stats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([jan, data]) => ({ jan, name: data.name, count: data.count }));
  res.json({ results: top });
});

// =========================================
// API Check — GET /api/check?jan=...
// Route duy nhất, tường minh, không dùng Router
// =========================================
app.get("/api/check", async (req, res) => {
  console.log("🎯 Đã nhận request JAN:", req.query.jan);

  const janCode = (req.query.jan ?? "").toString().trim();

  if (!janCode) {
    return res.status(400).json({ error: "Thiếu tham số: jan" });
  }
  if (!/^\d{8,14}$/.test(janCode)) {
    return res.status(400).json({ error: "Mã JAN không hợp lệ (cần 8–14 chữ số)" });
  }

  const browserId = `b_${Date.now()}`;
  let browser = null;

  console.log(`[${new Date().toLocaleTimeString()}] 🔍 Tìm kiếm JAN: ${janCode}`);

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
    activeBrowsers.set(browserId, browser);

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

    console.log("  → Đang cào song song 4 trang...");

    const [gameKaitoriResult, ichomeResult, homuraResult, morimoriResult] = await Promise.all([
      scrapeGameKaitori(page1, janCode),
      scrapeIchome(page2, janCode),
      scrapeHomura(page3, janCode),
      scrapeMoriMori(page4, janCode),
    ]);

    const results = [gameKaitoriResult, ichomeResult, homuraResult, morimoriResult];
    results.forEach((r) => {
      console.log(`  [${r.site}] ${r.status} → ${r.price ? "¥" + parseInt(r.price).toLocaleString() : "N/A"}`);
    });

    // Ghi nhận lượt tìm kiếm vào stats
    const firstName = results.find((r) => r.name)?.name ?? null;
    recordSearch(janCode, firstName);

    return res.json({ jan: janCode, results, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[ERROR]", err.message);
    return res.status(500).json({ error: "Lỗi server khi cào dữ liệu", details: err.message });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
      activeBrowsers.delete(browserId);
      console.log("  ✅ Browser đã đóng");
    }
  }
});

// =========================================
// 404 — sau mọi route khớp
// =========================================
app.use((req, res) => {
  console.log(`❌ 404 — ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// =========================================
// Lỗi từ next(err) — luôn trả JSON (đặt cuối stack)
// =========================================
app.use((err, req, res, next) => {
  console.error("[ERROR]", err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Lỗi server", details: err?.message || String(err) });
});

// =========================================
// Cleanup khi tắt
// =========================================
async function cleanup() {
  console.log("\n🛑 Đang đóng tất cả browsers...");
  for (const [, browser] of activeBrowsers) {
    try { await browser.close(); } catch { /* ignore */ }
  }
  activeBrowsers.clear();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (err) => { console.error("Uncaught:", err); cleanup(); });

// =========================================
// Start
// =========================================
app.listen(PORT, () => {
  console.log("📍 Backend đang đợi tại: GET /api/check");
  console.log(`🚀 PriceCheck Backend chạy tại http://localhost:${PORT}`);
  console.log(`📋 Gọi: GET http://localhost:${PORT}/api/check?jan=4902370553024`);
  console.log(`📊 Top: GET http://localhost:${PORT}/api/top-searches`);
  console.log(`🔧 Diagnostics: GET http://localhost:${PORT}/api/diagnostics`);
  console.log(`💹 Check profit: POST http://localhost:${PORT}/api/check-profit`);
  console.log(
    `📦 Inventory: GET|PUT http://localhost:${PORT}/api/my-inventory (alias: /api/inventory)`
  );
  console.log(
    "TCG Gemini stub: GET http://localhost:" + PORT + "/api/tcg/gemini (model: " + getGeminiModelId() + ")"
  );
  console.log(`🎭 Playwright Stealth: ĐÃ BẬT\n`);
});
