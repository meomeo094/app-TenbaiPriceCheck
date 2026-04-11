/**
 * test-suite.js — kiểm thử tự động backend PriceCheck
 * Chạy: node backend/scripts/test-suite.js
 * Yêu cầu: backend đang chạy tại http://localhost:3001
 */
"use strict";

const BASE = "http://localhost:3001";

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const results = [];

function section(title) {
  console.log(`\n${C.cyan}${C.bold}▶ ${title}${C.reset}`);
}

async function runTest(id, label, fn) {
  try {
    await fn();
    console.log(`${C.green}${C.bold}[PASS]${C.reset} [Test ${id}] ${label}`);
    results.push({ id, label, ok: true });
  } catch (e) {
    console.log(`${C.red}${C.bold}[FAIL]${C.reset} [Test ${id}] ${label}`);
    console.log(`       → ${e.message}`);
    results.push({ id, label, ok: false, reason: e.message });
  }
}

async function main() {
  console.log(`${C.bold}PriceCheck — Test Suite${C.reset}`);
  console.log(`Backend: ${BASE}\n`);

  // ─── Test 1: Health ───────────────────────────────────────
  section("Test 1 — Backend Health");
  await runTest(1, "GET / → {status:'ok'}", async () => {
    const r = await fetch(`${BASE}/`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.status !== "ok") throw new Error(`status="${d.status}"`);
  });

  // ─── Test 2: PUT /api/my-inventory ────────────────────────
  section("Test 2 — Thêm kho hàng");
  const TEST_JAN = "45496363767";
  await runTest(2, "Thêm kho hàng: HTTP 200 + item trong inventory", async () => {
    const r = await fetch(`${BASE}/api/my-inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory: [
          {
            id: "test-tcg-001",
            name: "Pokemon Card Test",
            jan: TEST_JAN,
            purchase_price: 9800,
          },
        ],
      }),
    });

    if (r.status !== 200) {
      const t = await r.text();
      throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
    }

    const d = await r.json();
    if (!d.ok) throw new Error(`ok=false — ${d.details ?? d.error ?? ""}`);
    if (!Array.isArray(d.inventory)) throw new Error("inventory không phải mảng");
    if (d.inventory.length === 0) throw new Error("inventory rỗng sau khi thêm");

    const found = d.inventory.find((x) => x.jan === TEST_JAN);
    if (!found) throw new Error(`Không có JAN ${TEST_JAN} trong inventory trả về`);
    if (found.purchase_price !== 9800) {
      throw new Error(`purchase_price mismatch: ${found.purchase_price}`);
    }
  });

  // ─── Test 3: GET /api/my-inventory ────────────────────────
  section("Test 3 — GET /api/my-inventory");
  await runTest(3, "Item vừa thêm vẫn tồn tại trong GET", async () => {
    const r = await fetch(`${BASE}/api/my-inventory`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!Array.isArray(d.inventory)) throw new Error("inventory không phải mảng");
    const found = d.inventory.find((x) => x.jan === TEST_JAN);
    if (!found) throw new Error(`JAN ${TEST_JAN} không có trong GET`);
  });

  // ─── Test 4: Validation ────────────────────────────────────
  section("Test 4 — Validation JAN sai");
  await runTest(4, "JAN không hợp lệ → HTTP 400", async () => {
    const r = await fetch(`${BASE}/api/my-inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory: [{ name: "Bad", jan: "abc", purchase_price: 100 }],
      }),
    });
    if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
  });

  // ─── Test 5: TCG Gemini stub ───────────────────────────────
  section("Test 5 — Truy cập Tab TCG (GET /api/tcg/gemini)");
  await runTest(5, "GET /api/tcg/gemini → 200 + stub:true + model", async () => {
    const r = await fetch(`${BASE}/api/tcg/gemini`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.ok) throw new Error("ok=false");
    if (!d.stub) throw new Error("stub field missing");
    if (!d.model) throw new Error("model field missing");
  });

  // ─── Test 6: Frontend /tcg-check ──────────────────────────
  section("Test 6 — Frontend route /tcg-check");
  await runTest(6, "GET http://localhost:3000/tcg-check → không phải 404", async () => {
    let r;
    try {
      r = await fetch("http://localhost:3000/tcg-check", {
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      // Frontend chưa khởi động — không phải lỗi code, skip
      throw new Error("Frontend offline tại :3000 — start 'npm run dev' để test UI");
    }
    if (r.status === 404) throw new Error("/tcg-check trả về 404");
    // 200 hoặc redirect (3xx) đều chấp nhận
  });

  // ─── Báo cáo ──────────────────────────────────────────────
  const line = "─".repeat(55);
  console.log(`\n${line}`);
  console.log(`${C.bold}BÁO CÁO KIỂM THỬ${C.reset}`);
  console.log(line);

  const KEY_TESTS = { 2: "Thêm kho hàng", 5: "Truy cập Tab TCG" };
  for (const [id, label] of Object.entries(KEY_TESTS)) {
    const r = results.find((x) => x.id === Number(id));
    if (!r) {
      console.log(`  [Test ${id}] ${label}: ${C.yellow}SKIP${C.reset}`);
    } else if (r.ok) {
      console.log(`  [Test ${id}] ${label}: ${C.green}${C.bold}PASS${C.reset}`);
    } else {
      console.log(
        `  [Test ${id}] ${label}: ${C.red}${C.bold}FAIL${C.reset} — ${r.reason}`
      );
    }
  }

  console.log(line);
  const totalPass = results.filter((r) => r.ok).length;
  const totalFail = results.filter((r) => !r.ok).length;
  console.log(
    `Tổng: ${C.green}${totalPass} PASS${C.reset} / ${C.red}${totalFail} FAIL${C.reset} / ${results.length} tests`
  );

  // Test 6 là optional (frontend có thể chưa chạy) — chỉ block commit nếu test 1-5 fail
  const criticalFails = results
    .filter((r) => r.id <= 5 && !r.ok)
    .length;

  if (criticalFails > 0) {
    console.log(
      `\n${C.red}${C.bold}❌ Có ${criticalFails} test quan trọng FAIL — KHÔNG commit.${C.reset}`
    );
    process.exit(1);
  } else {
    console.log(
      `\n${C.green}${C.bold}✅ Tất cả tests quan trọng PASS — sẵn sàng commit.${C.reset}`
    );
  }
}

main().catch((e) => {
  console.error("\nLỗi không mong đợi:", e.message);
  process.exit(1);
});
