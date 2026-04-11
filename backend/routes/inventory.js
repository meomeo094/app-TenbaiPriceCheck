const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { syncMyInventoryToSupabase } = require("../lib/supabase");

const router = express.Router();

const INVENTORY_FILE = path.join(__dirname, "..", "my_inventory.json");

function readFile() {
  if (!fs.existsSync(INVENTORY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(INVENTORY_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeFile(rows) {
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(rows, null, 2), "utf8");
}

/**
 * GET /api/my-inventory — đọc bảng (file my_inventory.json).
 */
router.get("/", (req, res) => {
  res.json({ inventory: readFile() });
});

/**
 * PUT /api/my-inventory — ghi đè toàn bộ danh sách.
 * Body: { inventory: [ { id?, name, jan, purchase_price } ] } — jan được map sang jan_code trên Supabase.
 */
router.put("/", async (req, res) => {
  console.log("Dữ liệu nhận được từ FE:", req.body);

  const inv = req.body?.inventory;
  if (!Array.isArray(inv)) {
    return res.status(400).json({ error: "Thiếu hoặc sai định dạng inventory (mảng)." });
  }

  const out = [];
  for (let i = 0; i < inv.length; i++) {
    const row = inv[i];
    const jan = String(row.jan ?? "").trim();
    const name = row.name != null ? String(row.name).trim() : "";
    const purchaseRaw = row.purchase_price;
    const purchase =
      typeof purchaseRaw === "number" ? purchaseRaw : parseInt(String(purchaseRaw ?? ""), 10);

    if (!/^\d{8,14}$/.test(jan)) {
      return res.status(400).json({
        error: `Dòng ${i + 1}: mã JAN không hợp lệ (8–14 chữ số).`,
        jan,
      });
    }
    if (!Number.isFinite(purchase) || purchase < 0) {
      return res.status(400).json({
        error: `Dòng ${i + 1}: giá mua không hợp lệ.`,
        jan,
      });
    }

    const id =
      row.id && String(row.id).trim()
        ? String(row.id).trim()
        : crypto.randomUUID();

    out.push({
      id,
      name,
      jan,
      purchase_price: purchase,
    });
  }

  writeFile(out);

  let syncResult;
  try {
    syncResult = await syncMyInventoryToSupabase(out);
  } catch (e) {
    console.error("[inventory] Exception when calling syncMyInventoryToSupabase:", e?.message);
    console.error(e?.stack);
    if (e && typeof e === "object") {
      console.error("[inventory] Exception (JSON):", JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }
    return res.status(503).json({
      ok: false,
      error: "Unexpected error while syncing to Supabase.",
      details: e?.message ?? String(e),
      inventory: out,
    });
  }

  if (!syncResult.ok) {
    console.error(
      "[inventory] INSERT/UPSERT Supabase FAILED — error count:",
      syncResult.errors?.length ?? 0
    );
    for (const item of syncResult.errors ?? []) {
      const err = item.error;
      console.error("[inventory] operation:", item.operation, "| Supabase error:", err);
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      console.error("  ->", msg);
      if (err && typeof err === "object") {
        console.error(
          "[inventory] full error:",
          JSON.stringify(err, Object.getOwnPropertyNames(err))
        );
      }
    }
    const summary =
      (syncResult.errors ?? [])
        .map((item) => {
          const err = item.error;
          const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
          return item.operation + ": " + msg;
        })
        .join(" | ") || "Unknown Supabase error.";
    return res.status(503).json({
      ok: false,
      error: "Failed to sync inventory to Supabase (my_inventory).",
      details: summary,
      inventory: out,
    });
  }

  console.log(
    "[inventory] OK: upserted to Supabase — table my_inventory (name, jan_code, purchase_price)."
  );

  res.json({ ok: true, inventory: out });
});

module.exports = router;
