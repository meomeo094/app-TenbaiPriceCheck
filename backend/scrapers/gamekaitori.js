/**
 * Scraper cho gamekaitori.jp (買取wiki)
 *
 * DOM structure:
 * - Trang chi tiết /purchase/...
 *   - Tên SP: h2.title (strip JAN code ở cuối)
 *   - Giá điều kiện: "未開封：45,200 円" / "新品未使用：8,900 円" — trong khối chính (trước 商品情報)
 *   - Lấy MAX trong tất cả mức điều kiện (giá thu mua cao nhất cho SP này)
 *
 * LỖI ĐÃ SỬA: .sub-pro-jia đầu tiên = SP gợi ý cùng hãng, không dùng querySelector đơn độc.
 */

const SITE_NAME = "GameKaitori";
const BASE_URL = "https://gamekaitori.jp";

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeGameKaitori(page, janCode) {
  const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 25000 });

    // --- Tìm link sản phẩm ---
    // Ưu tiên: URL chứa JAN (hầu hết sản phẩm game/console)
    // Fallback: link /purchase/ đầu tiên của gamekaitori.jp (iPhone/smartphone)
    const productLink = await page.evaluate((jan) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      // 1) URL chứa JAN
      for (const a of anchors) {
        const href = a.href;
        if (href.includes("gamekaitori.jp/purchase/") && href.includes(jan) && !href.includes("#")) {
          return href;
        }
      }
      // 2) Link gamekaitori.jp/purchase/ đầu tiên (JAN không nằm trong URL)
      for (const a of anchors) {
        const href = a.href;
        if (href.includes("gamekaitori.jp/purchase/") && !href.includes("#")) {
          return href;
        }
      }
      return null;
    }, janCode);

    if (!productLink) {
      return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "not_found" };
    }

    // --- Vào trang chi tiết ---
    // networkidle cần thiết vì giá điều kiện được render bởi JS sau khi DOM load
    await page.goto(productLink, { waitUntil: "networkidle", timeout: 30000 });

    const detail = await page.evaluate((jan) => {
      // === Lấy tên sản phẩm (h2.title, strip JAN + model code) ===
      const titleEl = document.querySelector("h2.title");
      let name = titleEl?.textContent?.trim() ?? null;
      let shortName = null; // tên không có JAN, dùng để match sub-pro-name
      if (name) {
        shortName = name.replace(jan, "").replace(/\b[A-Z0-9]+-[A-Z0-9-]+\b/g, "").replace(/\s+/g, " ").trim();
        name = shortName;
      }

      // === Helper functions ===
      function sliceMain(text) {
        const markers = ["商品情報", "\n買取不可品"];
        let end = text.length;
        for (const m of markers) {
          const i = text.indexOf(m);
          if (i >= 0 && i < end) end = i;
        }
        return text.slice(0, end);
      }

      function maxPrice(mainText) {
        const re = /[：:]\s*([\d,]+)\s*円/g;
        let m;
        let max = -1;
        while ((m = re.exec(mainText)) !== null) {
          const n = parseInt(m[1].replace(/,/g, ""), 10);
          if (!Number.isNaN(n) && n > 0 && n < 20000000) max = Math.max(max, n);
        }
        return max > 0 ? String(max) : null;
      }

      // === Lấy giá (3 cấp ưu tiên) ===
      let price = null;

      // 1) .rank_label span — giá chính đã được JS render (game/console)
      const rankLabel = document.querySelector(".rank_label span");
      if (rankLabel) {
        const t = rankLabel.textContent?.trim();
        if (t && /^[\d,]+$/.test(t)) price = t.replace(/,/g, "");
      }

      // 2) Condition block trong main text: "未開封：45,200 円"
      if (!price) {
        const mainText = sliceMain(document.body.innerText || "");
        price = maxPrice(mainText);
      }

      // 3) Fallback: .sub-pro-name + .sub-pro-jia khớp tên SP (smartphone/tablet)
      if (!price && shortName) {
        const nameEls = document.querySelectorAll(".sub-pro-name");
        for (const nameEl of nameEls) {
          const t = nameEl.textContent?.trim() ?? "";
          // Kiểm tra tên ngắn khớp (bỏ qua JAN/model trong URL)
          if (!shortName || !t.includes(shortName.slice(0, 10))) continue;
          let priceEl = nameEl.nextElementSibling;
          while (priceEl && !priceEl.classList.contains("sub-pro-jia")) {
            priceEl = priceEl.nextElementSibling;
          }
          if (!priceEl) continue;
          const m = priceEl.textContent?.match(/([\d,]+)円/);
          if (m) { price = m[1].replace(/,/g, ""); break; }
        }
      }

      return { name, price };
    }, janCode);

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

module.exports = { scrapeGameKaitori };
