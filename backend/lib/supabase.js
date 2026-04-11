/**
 * Ghi bảng my_inventory — chỉ dùng SUPABASE_SERVICE_ROLE_KEY (quyền cao nhất, không phụ thuộc RLS).
 * Cột DB: name, jan_code, purchase_price (khớp Supabase).
 */
const { createClient } = require("@supabase/supabase-js");

/** Client riêng cho ghi inventory (service role). */
let inventoryWriteClient = null;

/**
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
function getSupabaseInventoryWriter() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    return null;
  }
  if (!inventoryWriteClient) {
    inventoryWriteClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return inventoryWriteClient;
}

/** Key đang dùng (chỉ log tên biến). */
function whichSupabaseKeyEnv() {
  if ((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) return "SUPABASE_SERVICE_ROLE_KEY";
  return "(thiếu — cần service role để ghi my_inventory)";
}

function logSupabaseError(operation, error) {
  if (error == null) return;

  const msg = String(error.message ?? "");
  const code = error.code != null ? String(error.code) : "";
  const details = error.details != null ? String(error.details) : "";
  const hint = error.hint != null ? String(error.hint) : "";

  console.log(`[Supabase] THẤT BẠI — ${operation}`);
  console.log("  message:", msg);
  console.log("  code:   ", code || "(empty)");
  console.log("  details:", details || "(empty)");
  console.log("  hint:   ", hint || "(empty)");
  console.log("  env key:", whichSupabaseKeyEnv());

  let diagnosis = "";
  const low = msg.toLowerCase();
  if (
    code === "42501" ||
    low.includes("permission denied") ||
    low.includes("row-level security") ||
    low.includes("rls")
  ) {
    diagnosis =
      "→ RLS / quyền: đảm bảo SUPABASE_SERVICE_ROLE_KEY đúng (Settings → API → service_role).";
  } else if (
    code === "42P01" ||
    low.includes("does not exist") ||
    (low.includes("column") && (low.includes("does not exist") || low.includes("schema cache")))
  ) {
    diagnosis =
      "→ Sai tên cột/bảng: bảng public.my_inventory cần name, jan_code, purchase_price.";
  } else if (
    code === "PGRST301" ||
    low.includes("jwt") ||
    low.includes("invalid api key")
  ) {
    diagnosis = "→ Sai service_role secret — copy lại từ Supabase Dashboard.";
  } else if (code === "23505" || low.includes("unique")) {
    diagnosis = "→ Trùng jan_code (unique).";
  }

  if (diagnosis) {
    console.log("  chẩn đoán:", diagnosis);
  }

  try {
    console.log("  error (JSON):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  } catch {
    console.log("  error (raw):", error);
  }
}

const TABLE_MY_INVENTORY = "my_inventory";

/**
 * Payload gửi lên Supabase — khớp 100% cột: name, jan_code, purchase_price.
 * @param {Array<{ name: string, jan: string, purchase_price: number }>} rows — jan = mã JAN (map → jan_code)
 */
async function syncMyInventoryToSupabase(rows) {
  /** @type {Array<{ operation: string, error: unknown }>} */
  const errors = [];

  const supabase = getSupabaseInventoryWriter();
  if (!supabase) {
    const urlSet = Boolean((process.env.SUPABASE_URL || "").trim());
    const keySet = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
    console.error("");
    console.error("================================================================");
    console.error("SUPABASE: CANNOT WRITE my_inventory — MISSING .env CONFIG");
    console.error("================================================================");
    if (!urlSet) {
      console.error("  >> MISSING: SUPABASE_URL (Dashboard → Settings → API → Project URL)");
    } else {
      console.error("  OK: SUPABASE_URL is set");
    }
    if (!keySet) {
      console.error(
        "  >> MISSING: SUPABASE_SERVICE_ROLE_KEY (service_role secret — NOT anon key)"
      );
    } else {
      console.error("  OK: SUPABASE_SERVICE_ROLE_KEY is set");
    }
    console.error("  Copy backend/env.example → backend/.env and set both variables.");
    console.error("================================================================");
    console.error("");
    const configError = Object.assign(
      new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot upsert my_inventory."
      ),
      { code: "SUPABASE_CONFIG_MISSING" }
    );
    return { ok: false, errors: [{ operation: "supabase_config", error: configError }] };
  }

  // Validate: lọc bỏ dòng null/invalid trước khi gửi Supabase
  const payload = rows
    .filter((r) => r.jan && typeof r.jan === "string" && r.jan.trim().length > 0)
    .map((r) => ({
      name: (r.name ?? "").trim(),
      jan_code: String(r.jan).trim(),
      purchase_price: Number.isFinite(r.purchase_price) ? r.purchase_price : 0,
    }));

  // Chiến lược: DELETE ALL → INSERT (không phụ thuộc unique constraint trên jan_code).
  const { error: deleteAllError } = await supabase
    .from(TABLE_MY_INVENTORY)
    .delete()
    .not("jan_code", "is", null);   // điều kiện luôn true → xoá hết

  if (deleteAllError) {
    console.error("Lỗi Supabase delete-all:", deleteAllError);
    logSupabaseError("my_inventory.delete(all before insert)", deleteAllError);
    errors.push({ operation: "delete(all)", error: deleteAllError });
    return { ok: false, errors };
  }

  if (payload.length === 0) {
    console.log("[Supabase] Xoá toàn bộ my_inventory (inventory rỗng).");
    return { ok: true, errors: [] };
  }

  const { error: insertError } = await supabase
    .from(TABLE_MY_INVENTORY)
    .insert(payload);

  if (insertError) {
    console.error("Lỗi Supabase insert:", insertError);
    logSupabaseError("my_inventory.insert (bulk)", insertError);
    errors.push({ operation: "insert", error: insertError });
    return { ok: false, errors };
  }

  console.log(`[Supabase] INSERT OK — ${payload.length} dòng vào my_inventory.`);
  return { ok: true, errors: [] };
}

/** Giữ export để mở rộng (đọc metadata, v.v.) — cũng dùng service role nếu có. */
function getSupabase() {
  return getSupabaseInventoryWriter();
}

module.exports = {
  getSupabase,
  getSupabaseInventoryWriter,
  syncMyInventoryToSupabase,
  logSupabaseError,
  TABLE_MY_INVENTORY,
};
