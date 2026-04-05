/**
 * Scraper cho gamekaitori.jp (買取wiki)
 *
 * Hai nguồn giá:
 * 1) Trang kết quả tìm kiếm: cặp .sub-pro-name + .sub-pro-jia (khi có giá trên list)
 * 2) Trang chi tiết /purchase/...: giá điều kiện ở đầu trang, dạng 「未開封：45,200 円」
 *    — PHẢI lấy trong phần nội dung chính (trước 「商品情報」), lấy MAX nếu nhiều mức.
 *
 * LỖI ĐÃ SỬA: .sub-pro-jia đầu tiên trên trang chi tiết là của SP gợi ý (cùng hãng),
 * không phải SP đang xem → không dùng querySelector('.sub-pro-jia') đơn độc.
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

    // --- A) Thử lấy giá ngay trên trang kết quả (cặp name + jia) ---
    const fromSearch = await page.evaluate((jan) => {
      const blocks = document.querySelectorAll(".sub-pro-name");
      for (const nameEl of blocks) {
        const text = nameEl.textContent?.trim() || "";
        if (!text.includes(jan)) continue;

        let priceEl = nameEl.nextElementSibling;
        while (priceEl && !priceEl.classList.contains("sub-pro-jia")) {
          priceEl = priceEl.nextElementSibling;
        }
        if (!priceEl) {
          const parent = nameEl.parentElement;
          priceEl = parent?.querySelector(".sub-pro-jia") || null;
        }
        if (!priceEl) continue;

        const match = priceEl.textContent?.match(/[\d,]+円/);
        if (match) {
          const price = match[0].replace(/[,円]/g, "");
          let link = null;
          const container = nameEl.closest("a") || nameEl.parentElement?.querySelector("a[href*='/purchase/']");
          if (container?.href?.includes("/purchase/")) link = container.href;
          if (!link) {
            document.querySelectorAll("a[href*='/purchase/']").forEach((a) => {
              if (a.href.includes(jan) && !a.href.includes("#")) link = a.href;
            });
          }
          return { price, link };
        }
      }
      return null;
    }, janCode);

    if (fromSearch?.price) {
      let link = fromSearch.link;
      if (!link) {
        link = await page.evaluate((jan) => {
          for (const a of document.querySelectorAll("a[href*='/purchase/']")) {
            if (a.href.includes(jan) && !a.href.includes("#")) return a.href;
          }
          return null;
        }, janCode);
      }
      return {
        site: SITE_NAME,
        price: fromSearch.price,
        link: link || searchUrl,
        status: "success",
      };
    }

    // --- B) Vào trang chi tiết: URL phải chứa đúng JAN ---
    const productLink = await page.evaluate((jan) => {
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.href;
        if (
          href.includes("gamekaitori.jp/purchase/") &&
          href.includes(jan) &&
          !href.includes("#")
        ) {
          return href;
        }
      }
      return null;
    }, janCode);

    if (!productLink) {
      return { site: SITE_NAME, price: null, link: searchUrl, status: "not_found" };
    }

    await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1200);

    const detailPrice = await page.evaluate((jan) => {
      function nameMatchesJan(text, j) {
        if (!text || !j || !text.includes(j)) return false;
        const esc = j.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(^|[^0-9])${esc}([^0-9]|$)`);
        return re.test(text);
      }
      function maxPriceFromConditionBlock(mainText) {
        const r = /[：:]\s*([\d,]+)\s*円/g;
        let m;
        let max = -1;
        while ((m = r.exec(mainText)) !== null) {
          const n = parseInt(m[1].replace(/,/g, ""), 10);
          if (!Number.isNaN(n) && n > 0 && n < 10000000) max = Math.max(max, n);
        }
        return max > 0 ? String(max) : null;
      }
      function sliceMainProductText(fullText) {
        const markers = ["商品情報", "\n買取不可品"];
        let end = fullText.length;
        for (const mk of markers) {
          const i = fullText.indexOf(mk);
          if (i >= 0 && i < end) end = i;
        }
        return fullText.slice(0, end);
      }

      const full = document.body.innerText || "";
      const main = sliceMainProductText(full);
      const fromConditions = maxPriceFromConditionBlock(main);
      if (fromConditions) return fromConditions;

      const blocks = document.querySelectorAll(".sub-pro-name");
      for (const nameEl of blocks) {
        const text = nameEl.textContent?.trim() || "";
        if (!nameMatchesJan(text, jan)) continue;

        let priceEl = nameEl.nextElementSibling;
        while (priceEl && !priceEl.classList.contains("sub-pro-jia")) {
          priceEl = priceEl.nextElementSibling;
        }
        if (!priceEl) continue;
        const match = priceEl.textContent?.match(/[\d,]+円/);
        if (match) return match[0].replace(/[,円]/g, "");
      }
      return null;
    }, janCode);

    if (!detailPrice) {
      return { site: SITE_NAME, price: null, link: productLink, status: "not_found" };
    }

    return {
      site: SITE_NAME,
      price: detailPrice,
      link: productLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeGameKaitori };
