/**
 * Scraper cho www.1-chome.com (買取一丁目)
 *
 * Framework: Vue.js + Element Plus
 * Search input: .el-input__inner
 * Result card: .commodity-item
 *   - Tên SP: text node đầu tiên trong card (skip JAN/¥/badge labels)
 *   - Giá: span.text-right.text-sm → "¥8,900"
 *
 * Link trả về luôn là trang tìm theo JAN (đồng bộ với nút Xem / chia sẻ):
 *   /elec/search?q={jan}
 */

const SITE_NAME = "1-chome";
const BASE_URL = "https://www.1-chome.com";
const SEARCH_URL = `${BASE_URL}/index`;

/**
 * @param {string} janCode
 * @returns {string}
 */
function ichomeSearchUrl(janCode) {
  const q = encodeURIComponent(String(janCode).trim());
  return `${BASE_URL}/elec/search?q=${q}`;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeIchome(page, janCode) {
  const publicLink = ichomeSearchUrl(janCode);

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

    const noResult = await page
      .locator("text=見つかりませんでした, text=検索結果がありません, text=0件の商品")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (noResult) {
      return { site: SITE_NAME, name: null, price: null, link: publicLink, status: "not_found" };
    }

    const result = await page.evaluate(() => {
      const SKIP = new Set(["新品", "中古", "強化", "未使用", "カートに入れる", "注意事項"]);

      const cards = document.querySelectorAll(".commodity-item");
      let name = null;
      let price = null;

      for (const card of cards) {
        if (!name) {
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const t = node.textContent?.trim();
            if (t && t.length > 4 && !t.includes("JAN") && !t.startsWith("¥") && !SKIP.has(t)) {
              name = t;
              break;
            }
          }
        }

        const priceSpans = card.querySelectorAll("span.text-right.text-sm");
        for (const span of priceSpans) {
          const text = span.textContent?.trim();
          if (text && text.startsWith("¥")) {
            const n = parseInt(text.replace(/[¥,，\s]/g, ""), 10);
            if (!isNaN(n) && n > 0) {
              if (!price || n > parseInt(price, 10)) price = String(n);
            }
          }
        }

        if (name && price) break;
      }

      return { name, price };
    });

    if (!result.price) {
      return {
        site: SITE_NAME,
        name: result.name,
        price: null,
        link: publicLink,
        status: "not_found",
      };
    }

    return {
      site: SITE_NAME,
      name: result.name,
      price: result.price,
      link: publicLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: publicLink, status: "error" };
  }
}

module.exports = { scrapeIchome, ichomeSearchUrl };
