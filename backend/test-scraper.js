/**
 * Test script - Giả lập tìm kiếm với mã JAN mẫu
 * Chạy: node test-scraper.js
 */
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const { scrapeGameKaitori } = require("./scrapers/gamekaitori");
const { scrapeIchome } = require("./scrapers/ichome");
const { scrapeKaitoriShouten } = require("./scrapers/kaitorishouten");

chromium.use(StealthPlugin());

// Mã JAN mẫu: Nintendo Switch 2 (có trong cả 3 trang)
const TEST_JAN = "4902370553024";

async function runTest() {
  console.log("=".repeat(50));
  console.log("🧪 PriceCheck Backend Test");
  console.log(`📦 Mã JAN test: ${TEST_JAN}`);
  console.log("=".repeat(50));

  let browser = null;

  try {
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

    const [page1, page2, page3] = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    console.log("\n⏳ Đang cào song song 3 trang...\n");
    const startTime = Date.now();

    const [r1, r2, r3] = await Promise.all([
      scrapeGameKaitori(page1, TEST_JAN),
      scrapeIchome(page2, TEST_JAN),
      scrapeKaitoriShouten(page3, TEST_JAN),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Hoàn thành trong ${elapsed}s\n`);
    console.log("=".repeat(50));

    const results = [r1, r2, r3];
    results.forEach((r) => {
      const priceDisplay = r.price
        ? `¥${parseInt(r.price).toLocaleString("ja-JP")}`
        : "Không có giá";
      const statusEmoji = { success: "✅", error: "❌", not_found: "🔍" }[r.status] || "❓";
      console.log(`${statusEmoji} [${r.site}]`);
      console.log(`   Giá: ${priceDisplay}`);
      console.log(`   Link: ${r.link}`);
      console.log(`   Status: ${r.status}`);
      console.log();
    });

    console.log("=".repeat(50));
    const successCount = results.filter((r) => r.status === "success").length;
    console.log(`📊 Kết quả: ${successCount}/3 trang tìm thấy giá`);

    if (successCount > 0) {
      const highest = results
        .filter((r) => r.price)
        .sort((a, b) => parseInt(b.price) - parseInt(a.price))[0];
      console.log(
        `🏆 Giá cao nhất: ¥${parseInt(highest.price).toLocaleString("ja-JP")} (${highest.site})`
      );
    }
  } catch (err) {
    console.error("❌ Test thất bại:", err.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Browser đã đóng");
    }
  }
}

runTest();
