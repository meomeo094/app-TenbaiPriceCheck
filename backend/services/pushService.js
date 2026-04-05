/**
 * VAPID: tạo/ghi .env, cấu hình web-push, đọc subscription từ Supabase (fallback file JSON).
 */

const fs = require("fs");
const path = require("path");
const webpush = require("web-push");
const { getSupabase, getSupabaseForJobs } = require("../lib/supabase");

const ENV_PATH = path.join(__dirname, "..", ".env");
const SUBS_FILE = path.join(__dirname, "..", "push_subscriptions.json");
const DEFAULT_CONTACT = "mailto:admin@tenbai.com";

function readSubsFromFile() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
      return Array.isArray(raw) ? raw : [];
    }
  } catch (e) {
    console.error("[pushService] JSON subscription lỗi:", e.message);
  }
  return [];
}

/**
 * Cập nhật hoặc thêm dòng KEY=value trong nội dung .env (một dòng một biến).
 */
function upsertEnvKey(content, key, value) {
  const lines = (content || "").split(/\r?\n/);
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`);
  let found = false;
  const next = lines.map((line) => {
    if (re.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== "") {
      next.push("");
    }
    next.push(`${key}=${value}`);
  }
  return next.join("\n");
}

/**
 * Nếu thiếu VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: generate, in console, ghi .env, gán process.env.
 */
function ensureVapidKeysInEnvFile() {
  let pub = (process.env.VAPID_PUBLIC_KEY || "").trim();
  let priv = (process.env.VAPID_PRIVATE_KEY || "").trim();

  if (pub && priv) {
    return { generated: false, publicKey: pub, privateKey: priv };
  }

  const keys = webpush.generateVAPIDKeys();
  pub = keys.publicKey;
  priv = keys.privateKey;

  console.log("[pushService] Đã generate VAPID (lưu vào .env). Public:", pub);
  console.log("[pushService] Private:", priv);

  process.env.VAPID_PUBLIC_KEY = pub;
  process.env.VAPID_PRIVATE_KEY = priv;

  let body = "";
  try {
    if (fs.existsSync(ENV_PATH)) {
      body = fs.readFileSync(ENV_PATH, "utf8");
    }
  } catch (e) {
    console.error("[pushService] Đọc .env lỗi:", e.message);
  }

  body = upsertEnvKey(body, "VAPID_PUBLIC_KEY", pub);
  body = upsertEnvKey(body, "VAPID_PRIVATE_KEY", priv);

  if (!(process.env.VAPID_CONTACT_EMAIL || "").trim()) {
    process.env.VAPID_CONTACT_EMAIL = DEFAULT_CONTACT;
    body = upsertEnvKey(body, "VAPID_CONTACT_EMAIL", DEFAULT_CONTACT);
  }

  try {
    fs.writeFileSync(ENV_PATH, body, "utf8");
    console.log("[pushService] Đã cập nhật file .env (VAPID_*).");
  } catch (e) {
    console.error("[pushService] Ghi .env lỗi:", e.message);
  }

  return { generated: true, publicKey: pub, privateKey: priv };
}

function getVapidContactMailto() {
  const raw = (process.env.VAPID_CONTACT_EMAIL || "").trim();
  if (!raw) return DEFAULT_CONTACT;
  return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
}

function configureWebPush() {
  const pub = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!pub || !priv) {
    console.warn("[pushService] configureWebPush: thiếu VAPID sau khi ensure.");
    return false;
  }
  webpush.setVapidDetails(getVapidContactMailto(), pub, priv);
  return true;
}

function getSupabaseForPush() {
  return getSupabaseForJobs() || getSupabase();
}

/**
 * @returns {Promise<object[]>} Mảng subscription chuẩn Web Push (endpoint + keys).
 */
async function listSubscriptionsForWebPush() {
  const sb = getSupabaseForPush();
  if (!sb) {
    return readSubsFromFile();
  }

  try {
    const { data, error } = await sb.from("push_subscriptions").select("subscription");
    if (error) {
      console.error("[pushService] Supabase push_subscriptions:", error.message);
      return readSubsFromFile();
    }
    const out = [];
    for (const row of data || []) {
      const s = row && row.subscription;
      if (s && typeof s.endpoint === "string") {
        out.push(s);
      }
    }
    if (out.length) return out;
  } catch (e) {
    console.error("[pushService] listSubscriptionsForWebPush:", e.message);
  }
  return readSubsFromFile();
}

/**
 * Lưu / cập nhật subscription vào Supabase; fallback ghi file nếu DB lỗi.
 * @param {object} subscription PushSubscription JSON
 */
async function saveSubscription(subscription) {
  if (!subscription || typeof subscription.endpoint !== "string") {
    throw new Error("subscription không hợp lệ");
  }

  const sb = getSupabaseForPush();
  const row = {
    endpoint: subscription.endpoint,
    subscription,
    updated_at: new Date().toISOString(),
  };

  if (sb) {
    const { error } = await sb.from("push_subscriptions").upsert(row, {
      onConflict: "endpoint",
    });
    if (!error) {
      return { ok: true, storage: "supabase" };
    }
    console.error("[pushService] Upsert Supabase lỗi, dùng file:", error.message);
  }

  const list = readSubsFromFile().filter((s) => s.endpoint !== subscription.endpoint);
  list.push(subscription);
  fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), "utf8");
  return { ok: true, storage: "file" };
}

function getPublicVapidJsonResponse() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
  if (!publicKey) {
    return { configured: false, error: "Chưa cấu hình VAPID_PUBLIC_KEY." };
  }
  return { configured: true, publicKey };
}

async function removeSubscriptionEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return;
  const sb = getSupabaseForPush();
  if (sb) {
    const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) {
      console.error("[pushService] Xóa subscription DB:", error.message);
    }
  }
  try {
    const list = readSubsFromFile().filter((s) => s.endpoint !== endpoint);
    fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("[pushService] Ghi lại file subscription:", e.message);
  }
}

module.exports = {
  ensureVapidKeysInEnvFile,
  configureWebPush,
  getVapidContactMailto,
  listSubscriptionsForWebPush,
  saveSubscription,
  getPublicVapidJsonResponse,
  readSubsFromFile,
  removeSubscriptionEndpoint,
};
