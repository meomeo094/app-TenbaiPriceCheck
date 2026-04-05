const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const { scrapeGameKaitori } = require("./scrapers/gamekaitori");
const { scrapeIchome } = require("./scrapers/ichome");
const { scrapeHomura } = require("./scrapers/homura");
const { scrapeMoriMori } = require("./scrapers/morimori");

// Kích hoạt Stealth Plugin - BẮT BUỘC để qua Cloudflare/anti-bot
chromium.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

// =========================================
// CORS: origin * + cho phép header Ngrok (preflight từ browser)
// =========================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "ngrok-skip-browser-warning",
      "Authorization",
    ],
    exposedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// --- Routes (CORS middleware ở trên cùng, trước mọi route) ---
// Lưu trữ browser instances để tránh memory leak
const activeBrowsers = new Map();

// =========================================
// Health Check
// =========================================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "PriceCheck Backend đang chạy",
    timestamp: new Date().toISOString(),
  });
});

// =========================================
// API: Kiểm tra giá theo mã JAN
// GET /api/check-price?jan=4901777359702
// =========================================
app.get("/api/check-price", async (req, res) => {
  const janCode = req.query.jan?.toString().trim();

  if (!janCode) {
    return res.status(400).json({ error: "Thiếu tham số: jan" });
  }

  // Kiểm tra định dạng JAN code (8 hoặc 13 chữ số)
  if (!/^\d{8,14}$/.test(janCode)) {
    return res.status(400).json({ error: "Mã JAN không hợp lệ. Phải là 8-14 chữ số." });
  }

  const browserId = `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let browser = null;

  console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Tìm kiếm JAN: ${janCode}`);

  try {
    // Khởi động browser với Stealth mode
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
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

    // -------------------------------------------------------
    // Chạy song song 3 scrapers với Promise.all
    // -------------------------------------------------------
    const [page1, page2, page3, page4] = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    console.log(`  → Đang cào song song 3 trang...`);

    const [gameKaitoriResult, ichomeResult, homuraResult, morimoriResult] = await Promise.all([
      scrapeGameKaitori(page1, janCode),
      scrapeIchome(page2, janCode),
      scrapeHomura(page3, janCode),
      scrapeMoriMori(page4, janCode),
    ]);

    const results = [gameKaitoriResult, ichomeResult, homuraResult, morimoriResult];

    // Log kết quả
    results.forEach((r) => {
      const priceDisplay = r.price ? `¥${parseInt(r.price).toLocaleString()}` : "N/A";
      console.log(`  [${r.site}] ${r.status} → ${priceDisplay}`);
    });

    const response = {
      jan: janCode,
      results,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    console.error(`[ERROR] Lỗi tổng quát:`, err.message);
    res.status(500).json({
      error: "Lỗi server khi cào dữ liệu",
      details: err.message,
    });
  } finally {
    // BẮT BUỘC: Đóng browser để tránh zombie process
    if (browser) {
      try {
        await browser.close();
        console.log(`  ✅ Browser đã đóng`);
      } catch {
        // Ignore close errors
      }
      activeBrowsers.delete(browserId);
    }
  }
});

// 404 — JSON chuẩn (sau mọi route)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// =========================================
// Cleanup khi process tắt
// =========================================
async function cleanup() {
  console.log("\n🛑 Đang đóng tất cả browsers...");
  for (const [id, browser] of activeBrowsers) {
    try {
      await browser.close();
      console.log(`  Browser ${id} đã đóng`);
    } catch {
      // Ignore
    }
  }
  activeBrowsers.clear();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  cleanup();
});

// =========================================
// Start Server
// =========================================
app.listen(PORT, () => {
  console.log(`\n🚀 PriceCheck Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📋 API: GET /api/check-price?jan=[MÃ_JAN]`);
  console.log(`🎭 Playwright Stealth: ĐÃ BẬT\n`);
});
