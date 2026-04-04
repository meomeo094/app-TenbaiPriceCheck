/**
 * CSS Sprite Price Decoder cho kaitorishouten-co.jp
 * Sử dụng canvas API của browser để decode giá bị mã hóa
 */

/**
 * Decode giá từ sprite CSS qua canvas API (chạy trong browser context)
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{jan: string, price: string|null, rowId: string}>>}
 */
async function decodeKaitoriShoutenPrices(page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const rows = document.querySelectorAll(".price_list_item");
      if (!rows.length) {
        resolve([]);
        return;
      }

      // Lấy URL sprite từ span đầu tiên có mã hóa
      const firstSpan = document.querySelector(".encrypt-num");
      if (!firstSpan) {
        resolve([]);
        return;
      }

      const bgImage = window.getComputedStyle(firstSpan).backgroundImage;
      const spriteUrl = bgImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
      if (!spriteUrl) {
        resolve([]);
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const DIGIT_WIDTH = 10;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Build fingerprint for each 10px column in the sprite
        // fingerprint = sum of dark pixels per row (normalized)
        const fingerprints = {};
        for (let col = 0; col <= img.width - DIGIT_WIDTH; col += DIGIT_WIDTH) {
          const imageData = ctx.getImageData(col, 0, DIGIT_WIDTH, img.height);
          const profile = [];
          for (let y = 0; y < img.height; y++) {
            let darkCount = 0;
            for (let x = 0; x < DIGIT_WIDTH; x++) {
              const idx = (y * DIGIT_WIDTH + x) * 4;
              const brightness =
                (imageData.data[idx] +
                  imageData.data[idx + 1] +
                  imageData.data[idx + 2]) /
                3;
              if (brightness < 180) darkCount++;
            }
            profile.push(darkCount);
          }
          fingerprints[col] = profile;
        }

        // Classify digit from fingerprint using visual features
        function classifyDigit(profile) {
          const h = profile.length;
          const mid = Math.floor(h / 2);
          const topDark = profile.slice(1, Math.floor(h * 0.35)).reduce((a, b) => a + b, 0);
          const botDark = profile.slice(Math.floor(h * 0.65), h - 1).reduce((a, b) => a + b, 0);
          const midDark = profile.slice(Math.floor(h * 0.35), Math.floor(h * 0.65)).reduce((a, b) => a + b, 0);
          const topRow = profile[1] || 0;
          const midRow = profile[mid] || 0;
          const botRow = profile[h - 2] || 0;
          const totalDark = profile.reduce((a, b) => a + b, 0);

          // Feature ratios
          const topRatio = topDark / (totalDark + 0.1);
          const botRatio = botDark / (totalDark + 0.1);

          // Simple rules-based classifier
          if (totalDark < 5) return 1; // Very sparse = "1"
          if (topRow >= 4 && botRow >= 4 && midRow < 3) return 0; // Oval = "0"
          if (topRow >= 4 && botRow < 2 && midRow < 2) return 7; // Top bar only = "7"
          if (topRow >= 4 && botRow >= 4 && midRow >= 4) return 8; // Full = "8"
          if (topRow >= 4 && botRow >= 4 && midRow >= 3 && topRatio > 0.4) return 9;
          if (topRow < 2 && botRow >= 3 && midRow >= 3) return 2; // No top = "2"
          if (botRatio > 0.4 && topRow >= 3) return 5; // More bottom = "5"
          if (topRatio > 0.4 && botRow >= 3) return 6; // More top = "6"
          if (midRow >= 4 && topRow < 3) return 4; // Middle bar prominent = "4"
          return 3; // Default
        }

        // Decode each row
        const results = [];
        for (const row of rows) {
          const janEl = row.querySelectorAll(".product-code-default");
          const jan = janEl[janEl.length - 1]?.textContent?.trim();
          const priceEl = row.querySelector(".item-price.encrypt-price");
          const rowId = row.id || "";

          if (!priceEl) continue;

          const spans = priceEl.querySelectorAll(".encrypt-num");
          if (!spans.length) continue;

          let priceStr = "";
          let valid = true;

          for (const span of spans) {
            const bgPos = span.style.backgroundPosition;
            const match = bgPos.match(/-?(\d+)px/);
            const pixelOffset = match ? parseInt(match[1]) : 0;

            if (!(pixelOffset in fingerprints) && pixelOffset !== 0) {
              valid = false;
              break;
            }

            const fp = fingerprints[pixelOffset] || fingerprints[0];
            if (!fp) {
              valid = false;
              break;
            }

            const digit = classifyDigit(fp);
            priceStr += digit;
          }

          if (valid && priceStr.length > 0) {
            const numericPrice = parseInt(priceStr, 10);
            results.push({
              jan,
              price: numericPrice > 0 ? numericPrice.toString() : null,
              rowId,
            });
          }
        }

        resolve(results);
      };

      img.onerror = () => resolve([]);
      img.src = spriteUrl;
    });
  });
}

module.exports = { decodeKaitoriShoutenPrices };
