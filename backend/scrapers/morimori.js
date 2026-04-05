/**
 * Scraper cho morimori-kaitori.jp (森森買取)
 *
 * Flow: GET /search?sk=JAN → giá hiện NGAY trên trang kết quả, không cần navigate thêm.
 *
 * DOM:
 *   .price-normal-number  → "43,400円"  (通常買取価格)
 *   Product title: a.product-name hoặc <h2> trong card
 *   Product link: a[href*="/product/"] hoặc a.product-link
 */

const SITE_NAME = "MoriMori";
const BASE_URL = "https://www.morimori-kaitori.jp";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, price: string|null, link: string, status: string}>}
 */
async function scrapeMoriMori(page, janCode) {
  const searchUrl = `${BASE_URL}/search?sk=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    // Kiểm tra có kết quả không
    const noResult = await page
      .locator("text=検索結果がありません, text=0件, text=見つかりませんでした")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (noResult) {
      return { site: SITE_NAME, price: null, link: searchUrl, status: "not_found" };
    }

    // Lấy giá từ .price-normal-number (format "43,400円")
    const result = await page.evaluate(() => {
      const priceEl = document.querySelector(".price-normal-number");
      if (!priceEl) return null;

      const text = priceEl.textContent?.trim();
      if (!text || !/[\d,]+円/.test(text)) return null;

      return text.replace(/[,円\s]/g, "");
    });

    if (!result) {
      // Fallback: tìm yen value bất kỳ trong .product-price
      const fallback = await page.evaluate(() => {
        const el = document.querySelector(".product-price");
        if (!el) return null;
        const m = el.textContent?.match(/[\d,]+円/);
        return m ? m[0].replace(/[,円]/g, "") : null;
      });

      if (!fallback) {
        return { site: SITE_NAME, price: null, link: searchUrl, status: "not_found" };
      }

      return {
        site: SITE_NAME,
        price: fallback,
        link: searchUrl,
        status: "success",
      };
    }

    // Lấy link sản phẩm nếu có
    const productLink = await page.evaluate((base) => {
      const anchors = document.querySelectorAll("a[href]");
      for (const a of anchors) {
        const href = a.href;
        if (href.includes(base) && /\/product\/|\/item\/|\/detail\//.test(href)) {
          return href;
        }
      }
      return null;
    }, BASE_URL);

    return {
      site: SITE_NAME,
      price: result,
      link: productLink || searchUrl,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeMoriMori };
