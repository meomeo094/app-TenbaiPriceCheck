/**
 * Scraper cho kaitori-homura.com (買取ホムラ)
 *
 * Flow:
 *   1. GET /products?q[name_or_jan_code_cont]=JAN  → danh sách kết quả
 *   2. Lấy link đầu tiên /products/{id}
 *   3. Vào trang SP → lấy giá hiển thị cạnh "買取価格（税込）："
 *
 * DOM price: span.text-base.font-\[300\]  → "45,300円"
 *   (class Tailwind, selector phải dùng evaluate thay vì querySelector trực tiếp)
 */

const SITE_NAME = "Homura";
const BASE_URL = "https://kaitori-homura.com";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, price: string|null, link: string, status: string}>}
 */
async function scrapeHomura(page, janCode) {
  const searchUrl = `${BASE_URL}/products?q%5Bname_or_jan_code_cont%5D=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    // Lấy link sản phẩm đầu tiên khớp JAN
    const productLink = await page.evaluate(({ base }) => {
      const links = document.querySelectorAll("a[href]");
      for (const link of links) {
        const href = link.href;
        if (href.startsWith(base + "/products/") && /\/products\/\d+/.test(href)) {
          return href;
        }
      }
      return null;
    }, { base: BASE_URL });

    if (!productLink) {
      return { site: SITE_NAME, price: null, link: searchUrl, status: "not_found" };
    }

    // Vào trang chi tiết sản phẩm
    await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    // Lấy giá từ label "買取価格（税込）："
    // class Tailwind: "text-base font-[300]"
    const price = await page.evaluate(() => {
      // Ưu tiên: tìm text node sau label 買取価格
      const allEls = document.querySelectorAll("span, div, p");
      for (const el of allEls) {
        const cls = el.className || "";
        if (!cls.includes("font") && !cls.includes("text")) continue;
        const text = el.textContent?.trim();
        if (text && /^[\d,]+円$/.test(text)) {
          return text.replace(/[,円]/g, "");
        }
      }

      // Fallback: TreeWalker lấy yen value đầu tiên sau label 買取価格
      let foundLabel = false;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent?.trim();
        if (!t) continue;
        if (t.includes("買取価格")) {
          foundLabel = true;
          continue;
        }
        if (foundLabel && /^[\d,]+円$/.test(t)) {
          return t.replace(/[,円]/g, "");
        }
      }
      return null;
    });

    if (!price) {
      return { site: SITE_NAME, price: null, link: productLink, status: "not_found" };
    }

    return {
      site: SITE_NAME,
      price,
      link: productLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeHomura };
