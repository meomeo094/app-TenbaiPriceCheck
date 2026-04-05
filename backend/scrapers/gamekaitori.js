/**
 * Scraper cho gamekaitori.jp (買取wiki) + iphonekaitori.tokyo (vệ tinh iPhone)
 *
 * Luồng:
 * 1. Tìm kiếm JAN trên gamekaitori.jp/search
 * 2. Nếu link sản phẩm trỏ tới iphonekaitori.tokyo → dùng scrapeIphoneKaitori()
 * 3. Nếu là gamekaitori.jp/purchase/... → scrape bình thường
 * 4. Nếu không tìm thấy link nào → not_found
 *
 * DOM iphonekaitori.tokyo (và gamekaitori.jp) giống nhau:
 *   - h2.title              → tên SP
 *   - .rank_label span      → giá chính (JS-rendered)
 *   - condition block text  → "未開封：197,500 円" (fallback)
 */

const SITE_NAME  = "Wiki";
const GK_BASE    = "https://gamekaitori.jp";
const IPH_BASE   = "https://iphonekaitori.tokyo";

// JAN prefix của Apple iPhone / iPad (Apple Japan)
const APPLE_JAN_PREFIXES = ["4549995", "4549296", "0190199", "0195949", "0195243", "0194253"];

function isAppleJan(jan) {
  return APPLE_JAN_PREFIXES.some((p) => jan.startsWith(p));
}

// ─── helper functions (dùng cả 2 domain) ────────────────────────────────────

/**
 * Lấy giá từ trang chi tiết đã mở sẵn trên `page`.
 * Ưu tiên: rank_label span → condition block 未開封 → max condition → sub-pro-name match
 */
async function extractDetailPrice(page, janCode) {
  return page.evaluate((jan) => {
    const titleEl = document.querySelector("h2.title");
    let name = titleEl?.textContent?.trim() ?? null;
    if (name) {
      name = name
        .replace(jan, "")
        .replace(/\b[A-Z0-9]+-[A-Z0-9-]+\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    const shortName = name;

    function sliceMain(text) {
      const markers = ["商品情報", "\n買取不可品"];
      let end = text.length;
      for (const m of markers) {
        const i = text.indexOf(m);
        if (i >= 0 && i < end) end = i;
      }
      return text.slice(0, end);
    }

    /** 未開封 価格 を最優先で抜き出す */
    function mikaifuPrice(mainText) {
      // 未開封：197,500 円 または 未開封:197500円
      const re = /未開封[：:]\s*([\d,]+)\s*円/;
      const m = re.exec(mainText);
      if (m) return m[1].replace(/,/g, "");
      return null;
    }

    function maxConditionPrice(mainText) {
      const re = /[：:]\s*([\d,]+)\s*円/g;
      let m;
      let max = -1;
      while ((m = re.exec(mainText)) !== null) {
        const n = parseInt(m[1].replace(/,/g, ""), 10);
        if (!Number.isNaN(n) && n > 0 && n < 20_000_000) max = Math.max(max, n);
      }
      return max > 0 ? String(max) : null;
    }

    let price = null;

    // 1) .rank_label span
    const rankLabel = document.querySelector(".rank_label span");
    if (rankLabel) {
      const t = rankLabel.textContent?.trim();
      if (t && /^[\d,]+$/.test(t)) price = t.replace(/,/g, "");
    }

    // 2) 未開封 condition block (最優先スマホ)
    if (!price) {
      const mainText = sliceMain(document.body.innerText || "");
      price = mikaifuPrice(mainText) ?? maxConditionPrice(mainText);
    }

    // 3) Fallback: sub-pro-name + sub-pro-jia khớp shortName
    if (!price && shortName) {
      const nameEls = document.querySelectorAll(".sub-pro-name");
      for (const nameEl of nameEls) {
        const t = nameEl.textContent?.trim() ?? "";
        if (!t.includes(shortName.slice(0, 10))) continue;
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
}

// ─── scraper trang vệ tinh iphonekaitori.tokyo ───────────────────────────────

async function scrapeIphoneKaitori(page, janCode) {
  console.log("🔄 Đang chuyển hướng sang trang chuyên biệt iPhone để lấy giá chuẩn...");

  const searchUrl = `${IPH_BASE}/search?q=${encodeURIComponent(janCode)}`;

  await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });

  // Tìm link /purchase/ trên iphonekaitori.tokyo
  const productLink = await page.evaluate((base) => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    for (const a of anchors) {
      const href = a.href;
      if (href.startsWith(base + "/purchase/") && !href.includes("#")) return href;
    }
    return null;
  }, IPH_BASE);

  if (!productLink) {
    return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "not_found" };
  }

  await page.goto(productLink, { waitUntil: "networkidle", timeout: 30000 });

  const detail = await extractDetailPrice(page, janCode);

  if (!detail.price) {
    return { site: SITE_NAME, name: detail.name, price: null, link: productLink, status: "not_found" };
  }

  return { site: SITE_NAME, name: detail.name, price: detail.price, link: productLink, status: "success" };
}

// ─── scraper chính ──────────────────────────────────────────────────────────

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeGameKaitori(page, janCode) {
  const searchUrl = `${GK_BASE}/search?q=${encodeURIComponent(janCode)}`;

  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 25000 });

    // Tìm link sản phẩm từ trang kết quả
    const productLink = await page.evaluate(([jan, gkBase, iphBase]) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));

      // Ưu tiên 1: gamekaitori.jp/purchase/ chứa JAN trong URL
      for (const a of anchors) {
        const href = a.href;
        if (href.includes(gkBase + "/purchase/") && href.includes(jan) && !href.includes("#")) {
          return href;
        }
      }
      // Ưu tiên 2: iphonekaitori.tokyo/purchase/ (gamekaitori dẫn sang trang vệ tinh)
      for (const a of anchors) {
        const href = a.href;
        if (href.startsWith(iphBase + "/purchase/") && !href.includes("#")) {
          return href;
        }
      }
      // Fallback: gamekaitori.jp/purchase/ bất kỳ
      for (const a of anchors) {
        const href = a.href;
        if (href.includes(gkBase + "/purchase/") && !href.includes("#")) {
          return href;
        }
      }
      return null;
    }, [janCode, GK_BASE, IPH_BASE]);

    // Nếu trang gamekaitori không có link (hoặc product là iPhone) → dùng iphonekaitori.tokyo
    const isApple = isAppleJan(janCode);
    const pointsToIphone = productLink?.startsWith(IPH_BASE);

    if (isApple || pointsToIphone || !productLink) {
      // Với iPhone: gọi thẳng trang vệ tinh (page đã mở, reuse)
      return await scrapeIphoneKaitori(page, janCode);
    }

    // ─── Sản phẩm thông thường (game/console): scrape gamekaitori.jp ─────────
    await page.goto(productLink, { waitUntil: "networkidle", timeout: 30000 });

    const detail = await extractDetailPrice(page, janCode);

    if (!detail.price) {
      return { site: SITE_NAME, name: detail.name, price: null, link: productLink, status: "not_found" };
    }

    return { site: SITE_NAME, name: detail.name, price: detail.price, link: productLink, status: "success" };

  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: searchUrl, status: "error" };
  }
}

module.exports = { scrapeGameKaitori };
