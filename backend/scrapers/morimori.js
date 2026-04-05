/**
 * Scraper cho morimori-kaitori.jp (森森買取)
 *
 * Giá + tên hiện ngay trên trang kết quả, không cần navigate thêm.
 * DOM:
 *   .search-product-details-name → Tên SP
 *   .price-normal-number         → "43,400円" (通常買取価格)
 *   a[href*="/product/"]         → Link sản phẩm
 */

const SITE_NAME = "MoriMori";
const BASE_URL = "https://www.morimori-kaitori.jp";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeMoriMori(page, janCode) {
  const searchUrl = `${BASE_URL}/search?sk=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    const noResult = await page
      .locator("text=検索結果がありません, text=0件, text=見つかりませんでした")
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (noResult) {
      return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "not_found" };
    }

    const result = await page.evaluate((base) => {
      // === Tên SP ===
      const nameEl = document.querySelector(".search-product-details-name");
      const name = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? null;

      // === Giá: .price-normal-number ===
      const priceEl = document.querySelector(".price-normal-number");
      let price = null;
      if (priceEl) {
        const text = priceEl.textContent?.trim();
        if (text && /[\d,]+円/.test(text)) {
          price = text.replace(/[,円\s]/g, "");
        }
      }
      // Fallback: .product-price
      if (!price) {
        const el = document.querySelector(".product-price");
        if (el) {
          const m = el.textContent?.match(/[\d,]+円/);
          if (m) price = m[0].replace(/[,円]/g, "");
        }
      }

      // === Link SP ===
      let productLink = null;
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.href;
        if (href.includes(base) && /\/product\/|\/item\/|\/detail\//.test(href)) {
          productLink = href;
          break;
        }
      }

      return { name, price, productLink };
    }, BASE_URL);

    if (!result.price) {
      return { site: SITE_NAME, name: result.name, price: null, link: searchUrl, status: "not_found" };
    }

    return {
      site: SITE_NAME,
      name: result.name,
      price: result.price,
      link: result.productLink || searchUrl,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeMoriMori };
