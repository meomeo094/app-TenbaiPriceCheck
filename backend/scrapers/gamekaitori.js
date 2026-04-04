/**
 * Scraper cho gamekaitori.jp (買取wiki)
 * Search URL: GET /search?q=[keyword]
 * Product URL: /purchase/[product-slug]
 * Price format: "42500円" as plain text nodes
 */

const SITE_NAME = "GameKaitori";
const BASE_URL = "https://gamekaitori.jp";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, price: string|null, link: string, status: string}>}
 */
async function scrapeGameKaitori(page, janCode) {
  const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 25000 });

    // Lấy link sản phẩm từ kết quả tìm kiếm
    const productLink = await page.evaluate((base) => {
      const links = document.querySelectorAll("a[href]");
      for (const link of links) {
        const href = link.href;
        if (
          href.includes("gamekaitori.jp/purchase/") &&
          !href.includes("#") &&
          !href.includes("?")
        ) {
          return href;
        }
      }
      return null;
    }, BASE_URL);

    if (!productLink) {
      return { site: SITE_NAME, price: null, link: searchUrl, status: "not_found" };
    }

    // Điều hướng đến trang sản phẩm
    await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    // Lấy giá cao nhất từ trang sản phẩm (format: "42500円")
    const prices = await page.evaluate(() => {
      const results = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (text && /^\d+円$/.test(text)) {
          const value = parseInt(text.replace("円", ""), 10);
          if (value > 0 && value < 10000000) {
            results.push(value);
          }
        }
      }
      return results;
    });

    if (!prices || prices.length === 0) {
      return { site: SITE_NAME, price: null, link: productLink, status: "not_found" };
    }

    const highestPrice = Math.max(...prices);

    return {
      site: SITE_NAME,
      price: highestPrice.toString(),
      link: productLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeGameKaitori };
