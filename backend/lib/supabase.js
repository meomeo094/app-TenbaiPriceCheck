const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

let client = null;
let jobsClient = null;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

/**
 * Client cho job nền (cron): ưu tiên SUPABASE_SERVICE_ROLE_KEY để bypass RLS khi cập nhật monitor.
 */
function getSupabaseForJobs() {
  if (!supabaseUrl) return null;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const key = serviceKey || supabaseAnonKey;
  if (!key) return null;
  if (!jobsClient) {
    jobsClient = createClient(supabaseUrl, key);
  }
  return jobsClient;
}

/**
 * Kiểm tra kết nối Supabase (Env + truy vấn nhẹ tới bảng price_monitors).
 * Log lỗi chi tiết nếu thất bại; không throw.
 */
async function verifySupabaseConnection() {
  if (!supabaseUrl) {
    console.error(
      "[Supabase] Kết nối thất bại: biến môi trường SUPABASE_URL không được thiết lập hoặc rỗng."
    );
    return false;
  }
  if (!supabaseAnonKey) {
    console.error(
      "[Supabase] Kết nối thất bại: biến môi trường SUPABASE_ANON_KEY không được thiết lập hoặc rỗng."
    );
    return false;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error("[Supabase] Kết nối thất bại: không khởi tạo được client.");
    return false;
  }

  const { error } = await supabase.from("price_monitors").select("id").limit(1);

  if (error) {
    console.error("[Supabase] Kết nối / truy vấn thất bại:", error.message);
    if (error.code) console.error("[Supabase] Mã lỗi:", error.code);
    if (error.details) console.error("[Supabase] Chi tiết:", error.details);
    if (error.hint) console.error("[Supabase] Gợi ý:", error.hint);
    return false;
  }

  console.log("[Supabase] Kết nối OK (đã thử đọc bảng price_monitors).");
  return true;
}

module.exports = { getSupabase, getSupabaseForJobs, verifySupabaseConnection };
