const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { scrapeGameKaitori } = require("./scrapers/gamekaitori");
const { scrapeIchome } = require("./scrapers/ichome");
const { scrapeHomura } = require("./scrapers/homura");
const { scrapeMoriMori } = require("./scrapers/morimori");

chromium.use(StealthPlugin());

const JAN = "4549995648300"; // iPhone

async function main() {
  console.log("=== iPhone Test JAN:", JAN, "===");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    locale: "ja-JP",
  });

  const [p1, p2, p3, p4] = await Promise.all([
    ctx.newPage(), ctx.newPage(), ctx.newPage(), ctx.newPage(),
  ]);

  console.time("total");
  const results = await Promise.all([
    scrapeGameKaitori(p1, JAN),
    scrapeIchome(p2, JAN),
    scrapeHomura(p3, JAN),
    scrapeMoriMori(p4, JAN),
  ]);
  console.timeEnd("total");

  for (const r of results) {
    const flag = r.status === "success" ? "✅" : r.status === "not_found" ? "⚠️" : "❌";
    console.log(`${flag} [${r.site}] status=${r.status}`);
    if (r.name) console.log(`   name: ${r.name}`);
    if (r.price) console.log(`   price: ¥${Number(r.price).toLocaleString("ja-JP")}`);
    console.log(`   link: ${r.link}`);
  }

  await browser.close();
}

main().catch(console.error);
