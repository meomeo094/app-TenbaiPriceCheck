/**
 * Scraper cho www.1-chome.com (買取一丁目)
 * Framework: Vue.js + Element Plus (El-UI)
 * Search input: .el-input__inner (placeholder: 商品名・JANコードで検索)
 * Price selector: span.text-right.text-sm (format: ¥75,000)
 * Results URL: /searchResult
 */

const SITE_NAME = "1-chome";
const BASE_URL = "https://www.1-chome.com";
const SEARCH_URL = `${BASE_URL}/index`;

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, price: string|null, link: string, status: string}>}
 */
async function scrapeIchome(page, janCode) {
  try {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    // Tìm input Element Plus (Vue.js form - không dùng fill() vì sẽ bị Vue intercept)
    const searchInput = page.locator(".el-input__inner").first();
    await searchInput.waitFor({ state: "visible", timeout: 8000 });

    // Giả lập nhập bàn phím để Vue component nhận event
    await searchInput.click();
    await page.keyboard.type(janCode, { delay: 60 });
    await page.waitForTimeout(300);

    // Click nút Tìm kiếm
    const searchBtn = page.locator("button:has-text('検索')").first();
    const hasBtnVisible = await searchBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasBtnVisible) {
      await searchBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    // Chờ trang kết quả load
    await page.waitForURL("**/searchResult*", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const currentUrl = page.url();

    // Kiểm tra không có kết quả
    const noResult = await page
      .locator(
        "text=見つかりませんでした, text=検索結果がありません, text=0件の商品"
      )
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (noResult) {
      return { site: SITE_NAME, price: null, link: currentUrl, status: "not_found" };
    }

    // Lấy tất cả giá từ trang kết quả
    // Price format: ¥75,000 trong span.text-right.text-sm
    const prices = await page.evaluate(() => {
      const priceSpans = document.querySelectorAll("span.text-right.text-sm");
      const results = [];
      for (const span of priceSpans) {
        const text = span.textContent?.trim();
        if (text && text.startsWith("¥")) {
          const numStr = text.replace(/[¥,，\s]/g, "");
          const value = parseInt(numStr, 10);
          if (!isNaN(value) && value > 0) {
            results.push(value);
          }
        }
      }
      return results;
    });

    if (!prices || prices.length === 0) {
      return { site: SITE_NAME, price: null, link: currentUrl, status: "not_found" };
    }

    const highestPrice = Math.max(...prices);

    return {
      site: SITE_NAME,
      price: highestPrice.toString(),
      link: currentUrl,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return {
      site: SITE_NAME,
      price: null,
      link: SEARCH_URL,
      status: "error",
    };
  }
}

module.exports = { scrapeIchome };
