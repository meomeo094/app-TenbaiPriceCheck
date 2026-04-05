/**
 * Test script - Chạy: node test-scraper.js
 * Giả lập tìm kiếm với mã JAN thật để xác nhận data khớp web.
 */
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const { scrapeGameKaitori } = require("./scrapers/gamekaitori");
const { scrapeIchome } = require("./scrapers/ichome");
const { scrapeHomura } = require("./scrapers/homura");
const { scrapeMoriMori } = require("./scrapers/morimori");

chromium.use(StealthPlugin());

// Nintendo Switch 2 日本語・国内専用 — có mặt trên cả 4 trang
const TEST_JAN = "4902370553024";

async function runTest() {
  console.log("=".repeat(55));
  console.log("🧪 PriceCheck Backend Test  (4 scrapers)");
  console.log(`📦 JAN: ${TEST_JAN}`);
  console.log("=".repeat(55));

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=ja-JP"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });

    const [p1, p2, p3, p4] = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    console.log("\n⏳ Đang cào song song 4 trang...\n");
    const t0 = Date.now();

    const [r1, r2, r3, r4] = await Promise.all([
      scrapeGameKaitori(p1, TEST_JAN),
      scrapeIchome(p2, TEST_JAN),
      scrapeHomura(p3, TEST_JAN),
      scrapeMoriMori(p4, TEST_JAN),
    ]);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ Xong trong ${elapsed}s\n`);
    console.log("=".repeat(55));

    const results = [r1, r2, r3, r4];
    results.forEach((r) => {
      const emoji = { success: "✅", error: "❌", not_found: "🔍" }[r.status] ?? "❓";
      const priceDisplay = r.price
        ? `¥${parseInt(r.price).toLocaleString("ja-JP")}`
        : "—";
      console.log(`${emoji} [${r.site}]`);
      console.log(`   Giá  : ${priceDisplay}`);
      console.log(`   Link : ${r.link}`);
      console.log(`   Status: ${r.status}`);
      console.log();
    });

    console.log("=".repeat(55));
    const hits = results.filter((r) => r.status === "success" && r.price);
    console.log(`📊 ${hits.length}/${results.length} trang tìm thấy giá`);

    if (hits.length > 0) {
      const best = hits.reduce((a, b) =>
        parseInt(a.price) >= parseInt(b.price) ? a : b
      );
      console.log(
        `🏆 Cao nhất: ¥${parseInt(best.price).toLocaleString("ja-JP")} (${best.site})`
      );
    }
  } catch (err) {
    console.error("❌ Test lỗi:", err.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Browser đã đóng");
    }
  }
}

runTest();
