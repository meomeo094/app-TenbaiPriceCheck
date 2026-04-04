/**
 * Scraper cho www.kaitorishouten-co.jp (買取商店)
 * Search form: input[name="name"].search-name → POST /products/list/keyword
 * Price display: CSS sprite encryption (.item-price .encrypt-num)
 * Decode method: canvas API trong browser context
 */

const SITE_NAME = "KaitoriShouten";
const BASE_URL = "https://www.kaitorishouten-co.jp";
const { decodeKaitoriShoutenPrices } = require("./priceDecoder");

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, price: string|null, link: string, status: string}>}
 */
async function scrapeKaitoriShouten(page, janCode) {
  try {
    await page.goto(BASE_URL + "/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    // Tìm input search
    const searchInput = page.locator("input[name='name'].search-name");
    await searchInput.waitFor({ state: "visible", timeout: 8000 });
    await searchInput.click();
    await page.keyboard.type(janCode, { delay: 50 });
    await page.keyboard.press("Enter");

    // Chờ kết quả load (trang ở lại /,  kết quả hiện trên trang)
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();

    // Kiểm tra có kết quả không
    const hasResults = await page
      .locator(".price_list_item")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasResults) {
      return { site: SITE_NAME, price: null, link: currentUrl, status: "not_found" };
    }

    // Decode giá qua canvas API
    let targetPrice = null;
    let targetLink = currentUrl;

    try {
      const decoded = await decodeKaitoriShoutenPrices(page);

      // Tìm sản phẩm match JAN code
      const match = decoded.find((r) => r.jan === janCode);
      if (match && match.price) {
        targetPrice = match.price;
      } else if (decoded.length > 0 && decoded[0].price) {
        // Lấy giá đầu tiên nếu không match chính xác
        targetPrice = decoded[0].price;
      }
    } catch (decodeErr) {
      console.error(`[${SITE_NAME}] Lỗi decode:`, decodeErr.message);
    }

    if (!targetPrice) {
      // Fallback: trả về link để user tự kiểm tra
      return {
        site: SITE_NAME,
        price: null,
        link: currentUrl,
        status: "not_found",
      };
    }

    return {
      site: SITE_NAME,
      price: targetPrice,
      link: currentUrl,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return {
      site: SITE_NAME,
      price: null,
      link: BASE_URL,
      status: "error",
    };
  }
}

module.exports = { scrapeKaitoriShouten };
