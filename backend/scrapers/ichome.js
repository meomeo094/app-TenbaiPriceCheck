/**
 * Scraper cho www.1-chome.com (買取一丁目)
 *
 * Framework: Vue.js + Element Plus
 * Search input: .el-input__inner
 * Result card: .commodity-item (Tailwind grid) → first text = product name
 * Price: span.text-right.text-sm → "¥8,900"
 */

const SITE_NAME = "1-chome";
const BASE_URL = "https://www.1-chome.com";
const SEARCH_URL = `${BASE_URL}/index`;

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeIchome(page, janCode) {
  try {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    const searchInput = page.locator(".el-input__inner").first();
    await searchInput.waitFor({ state: "visible", timeout: 8000 });
    await searchInput.click();
    await page.keyboard.type(janCode, { delay: 60 });
    await page.waitForTimeout(300);

    const searchBtn = page.locator("button:has-text('検索')").first();
    const hasBtnVisible = await searchBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasBtnVisible) {
      await searchBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForURL("**/searchResult*", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const currentUrl = page.url();

    const noResult = await page
      .locator("text=見つかりませんでした, text=検索結果がありません, text=0件の商品")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (noResult) {
      return { site: SITE_NAME, name: null, price: null, link: currentUrl, status: "not_found" };
    }

    const result = await page.evaluate((jan) => {
      // === Lấy tên sản phẩm từ .commodity-item ===
      let name = null;
      const cards = document.querySelectorAll(".commodity-item");
      const SKIP = new Set(["新品", "中古", "強化", "未使用", "カートに入れる", "注意事項"]);
      for (const card of cards) {
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim();
          if (t && t.length > 4 && !t.includes("JAN") && !t.startsWith("¥") && !SKIP.has(t)) {
            name = t;
            break;
          }
        }
        if (name) break;
      }

      // === Lấy giá cao nhất trong tất cả span giá ===
      const priceSpans = document.querySelectorAll("span.text-right.text-sm");
      let maxVal = -1;
      for (const span of priceSpans) {
        const text = span.textContent?.trim();
        if (text && text.startsWith("¥")) {
          const n = parseInt(text.replace(/[¥,，\s]/g, ""), 10);
          if (!isNaN(n) && n > 0) maxVal = Math.max(maxVal, n);
        }
      }

      return { name, price: maxVal > 0 ? String(maxVal) : null };
    }, janCode);

    if (!result.price) {
      return { site: SITE_NAME, name: result.name, price: null, link: currentUrl, status: "not_found" };
    }

    return {
      site: SITE_NAME,
      name: result.name,
      price: result.price,
      link: currentUrl,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: SEARCH_URL, status: "error" };
  }
}

module.exports = { scrapeIchome };
