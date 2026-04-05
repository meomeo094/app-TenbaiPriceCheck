/**
 * Scraper cho kaitori-homura.com (買取ホムラ)
 *
 * Flow:
 *   1. GET /products?q[name_or_jan_code_cont]=JAN → lấy link /products/{id}
 *   2. Vào trang SP → tên: h3.text-xl.font-semibold.text-primary-blue
 *                  → giá: TreeWalker sau label 買取価格
 */

const SITE_NAME = "Homura";
const BASE_URL = "https://kaitori-homura.com";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeHomura(page, janCode) {
  const searchUrl = `${BASE_URL}/products?q%5Bname_or_jan_code_cont%5D=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

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
      return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "not_found" };
    }

    await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    const detail = await page.evaluate(() => {
      // === Tên SP: h3 màu primary-blue (class Tailwind) ===
      let name = null;
      const h3s = document.querySelectorAll("h3");
      for (const h of h3s) {
        const cls = h.className || "";
        if (cls.includes("primary-blue") || cls.includes("semibold")) {
          const t = h.textContent?.trim();
          if (t && t.length > 2 && !t.includes("買取")) {
            name = t;
            break;
          }
        }
      }
      // Fallback: body text giữa 商品詳細 và 買取価格
      if (!name) {
        const lines = (document.body.innerText || "").split("\n").map(l => l.trim()).filter(Boolean);
        let idx = lines.indexOf("商品詳細");
        if (idx >= 0) {
          for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
            const l = lines[i];
            if (l.length > 3 && !l.includes("買取") && !l.includes("ログイン")) {
              name = l;
              break;
            }
          }
        }
      }

      // === Giá: TreeWalker sau label 買取価格 ===
      let foundLabel = false;
      let price = null;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent?.trim();
        if (!t) continue;
        if (t.includes("買取価格")) { foundLabel = true; continue; }
        if (foundLabel && /^[\d,]+円$/.test(t)) {
          price = t.replace(/[,円]/g, "");
          break;
        }
      }

      return { name, price };
    });

    if (!detail.price) {
      return { site: SITE_NAME, name: detail.name, price: null, link: productLink, status: "not_found" };
    }

    return {
      site: SITE_NAME,
      name: detail.name,
      price: detail.price,
      link: productLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeHomura };
