/**
 * Scraper cho tobansyoji.co.jp (買取東版商事)
 *
 * Flow:
 *   1. Navigate tới trang tìm kiếm với JAN code
 *   2. Lấy link sản phẩm đầu tiên trong kết quả
 *   3. Vào trang chi tiết → lấy tên SP và giá mua (買取価格)
 *
 * Nếu trang tìm kiếm trả kết quả ngay trên listing → lấy luôn mà không cần navigate thêm.
 *
 * DOM pattern phổ biến của tobansyoji.co.jp:
 *   Tìm kiếm: /shop/search/?keyword=JAN   (hoặc /?s=JAN&post_type=product)
 *   Tên SP  : h2.woocommerce-loop-product__title | h1.product_title | .entry-title
 *   Giá     : span.price → ins span.woocommerce-Price-amount | bdi
 *   Link    : a.woocommerce-LoopProduct-link | .product a
 */

"use strict";

const SITE_NAME = "Toban";
const BASE_URL  = "https://tobansyoji.co.jp";

/**
 * Trả URL tìm kiếm công khai (dùng làm fallback link).
 * @param {string} janCode
 */
function tobanSearchUrl(janCode) {
  return `${BASE_URL}/?s=${encodeURIComponent(janCode)}&post_type=product`;
}

/**
 * Thử nhiều URL tìm kiếm để tăng tỷ lệ tìm thấy.
 */
function buildSearchUrls(janCode) {
  const q = encodeURIComponent(janCode);
  return [
    `${BASE_URL}/?s=${q}&post_type=product`,
    `${BASE_URL}/shop/?s=${q}`,
    `${BASE_URL}/products/?keyword=${q}`,
    `${BASE_URL}/kaitori/?q=${q}`,
  ];
}

/**
 * Trích giá và tên từ trang hiện tại (listing hoặc chi tiết).
 * @param {import('playwright').Page} page
 * @returns {Promise<{name: string|null, price: string|null, productLink: string|null}>}
 */
async function extractFromPage(page) {
  return page.evaluate((base) => {
    /**
     * Tìm số nguyên > 0 từ chuỗi (xử lý dấu phẩy Nhật: 43,400)
     * @param {string} text
     */
    function parseJpPrice(text) {
      const cleaned = text.replace(/[¥￥,，\s円]/g, "");
      const n = parseInt(cleaned, 10);
      return !isNaN(n) && n > 0 ? n : null;
    }

    /**
     * Duyệt TreeWalker để tìm giá sau label 買取価格 / 買取値段 / 買取金額
     */
    function findPriceByLabel() {
      const priceLabels = ["買取価格", "買取値段", "買取金額", "買取金額（税込）", "買取"];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      let foundLabel = false;
      while ((node = walker.nextNode())) {
        const t = node.textContent?.trim();
        if (!t) continue;
        if (!foundLabel && priceLabels.some((lbl) => t.includes(lbl))) {
          foundLabel = true;
          continue;
        }
        if (foundLabel) {
          const n = parseJpPrice(t);
          if (n) return String(n);
          // nếu gặp dòng dài không phải số → reset để tránh lấy nhầm
          if (t.length > 20) foundLabel = false;
        }
      }
      return null;
    }

    // ─── 1. WooCommerce listing: nhiều card kết quả ───────────────────────────
    const loopCards = document.querySelectorAll(
      "li.product, .product-grid-item, .type-product, article.product"
    );
    if (loopCards.length > 0) {
      let name = null;
      let price = null;
      let productLink = null;

      for (const card of loopCards) {
        // Tên
        if (!name) {
          const titleEl = card.querySelector(
            "h2.woocommerce-loop-product__title, .product-title, h2, h3"
          );
          const t = titleEl?.textContent?.trim();
          if (t && t.length > 2) name = t;
        }

        // Link sản phẩm chi tiết
        if (!productLink) {
          const linkEl = card.querySelector(
            "a.woocommerce-LoopProduct-link, a[href*='/product/'], a.product-link, a.wp-post-link-url"
          );
          if (linkEl?.href) productLink = linkEl.href;
        }

        // Giá: WooCommerce dùng ins > bdi khi có sale
        const insPrice = card.querySelector("ins .woocommerce-Price-amount bdi, ins bdi");
        if (insPrice) {
          const n = parseJpPrice(insPrice.textContent ?? "");
          if (n) { price = String(n); break; }
        }
        const anyPrice = card.querySelector(".woocommerce-Price-amount bdi, .price");
        if (anyPrice) {
          const n = parseJpPrice(anyPrice.textContent ?? "");
          if (n && !price) price = String(n);
        }

        if (name && price) break;
      }

      if (price) return { name, price, productLink };
    }

    // ─── 2. Trang chi tiết sản phẩm ───────────────────────────────────────────
    // Tên
    let name = null;
    const titleEl = document.querySelector(
      "h1.product_title, h1.entry-title, h1.woocommerce-product-title, h1, h2.product-name"
    );
    if (titleEl) name = titleEl.textContent?.trim() ?? null;

    // Giá: ưu tiên ins (sale price) → span.price → label scan
    let price = null;
    const saleEl = document.querySelector("ins .woocommerce-Price-amount bdi, p.price ins bdi");
    if (saleEl) price = String(parseJpPrice(saleEl.textContent ?? "") ?? "");

    if (!price) {
      const priceEl = document.querySelector(
        ".woocommerce-Price-amount bdi, span.price, .kaitori-price, .buy-price"
      );
      if (priceEl) {
        const n = parseJpPrice(priceEl.textContent ?? "");
        if (n) price = String(n);
      }
    }

    // Label scan fallback
    if (!price) price = findPriceByLabel();

    // ─── 3. Fallback toàn trang: tìm số tiền Nhật lớn nhất liên quan kaitori ──
    if (!price) {
      const bodyText = document.body.innerText || "";
      const lines = bodyText.split("\n").map((l) => l.trim()).filter(Boolean);
      const kaitoriBoundary = lines.findIndex((l) =>
        l.includes("買取") || l.includes("kaitori")
      );
      if (kaitoriBoundary >= 0) {
        for (let i = kaitoriBoundary; i < Math.min(kaitoriBoundary + 10, lines.length); i++) {
          const n = parseJpPrice(lines[i]);
          if (n && n > 100) { price = String(n); break; }
        }
      }
    }

    return { name, price: price || null, productLink: null };
  }, BASE_URL);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} janCode
 * @returns {Promise<{site: string, name: string|null, price: string|null, link: string, status: string}>}
 */
async function scrapeTobanSyoji(page, janCode) {
  const publicLink = tobanSearchUrl(janCode);
  const searchUrls = buildSearchUrls(janCode);

  try {
    let landed = false;

    for (const url of searchUrls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1800);

        // Kiểm tra có kết quả không
        const hasNoResult = await page
          .locator("text=見つかりません, text=検索結果なし, text=0件, text=商品が見つかりません")
          .first()
          .isVisible({ timeout: 1500 })
          .catch(() => false);

        if (!hasNoResult) {
          landed = true;
          break;
        }
      } catch {
        // URL này không hoạt động → thử URL tiếp theo
      }
    }

    if (!landed) {
      return { site: SITE_NAME, name: null, price: null, link: publicLink, status: "not_found" };
    }

    // ─── Thử lấy dữ liệu từ trang listing hiện tại ─────────────────────────
    let detail = await extractFromPage(page);

    // ─── Nếu listing không có giá, tìm link SP và navigate vào ────────────
    if (!detail.price && detail.productLink) {
      try {
        await page.goto(detail.productLink, { waitUntil: "domcontentloaded", timeout: 18000 });
        await page.waitForTimeout(1500);
        detail = await extractFromPage(page);
      } catch {
        // navigate thất bại — dùng kết quả listing
      }
    }

    // Nếu vẫn không thấy link, dò link từ DOM hiện tại
    if (!detail.price && !detail.productLink) {
      const productLink = await page.evaluate((base) => {
        const patterns = ["/product/", "/kaitori/", "/item/", "/?p=", "/shop/"];
        for (const a of document.querySelectorAll("a[href]")) {
          const href = a.href;
          if (href.startsWith(base) && patterns.some((p) => href.includes(p)) && !href.includes("#")) {
            return href;
          }
        }
        return null;
      }, BASE_URL);

      if (productLink) {
        try {
          await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: 18000 });
          await page.waitForTimeout(1500);
          detail = await extractFromPage(page);
        } catch {
          // ignore
        }
      }
    }

    const currentUrl = page.url();

    if (!detail.price) {
      return {
        site: SITE_NAME,
        name: detail.name,
        price: null,
        link: detail.productLink || currentUrl || publicLink,
        status: "not_found",
      };
    }

    return {
      site: SITE_NAME,
      name: detail.name,
      price: detail.price,
      link: detail.productLink || currentUrl || publicLink,
      status: "success",
    };
  } catch (err) {
    console.error(`[${SITE_NAME}] Lỗi:`, err.message);
    return { site: SITE_NAME, name: null, price: null, link: publicLink, status: "error" };
  }
}

module.exports = { scrapeTobanSyoji, tobanSearchUrl };
