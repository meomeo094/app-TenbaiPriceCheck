export interface PriceResult {
  site: string;
  name: string | null;
  price: string | null;
  link: string;
  status: "success" | "error" | "not_found";
}

export interface CheckPriceResponse {
  jan: string;
  results: PriceResult[];
  timestamp: string;
}

export interface TopSearch {
  jan: string;
  name: string | null;
  count: number;
}

export const API_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

/** fetch same-origin path (or absolute URL). Luôn kèm Ngrok header. */
export async function apiFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: HeadersInit }
): Promise<Response> {
  const finalUrl = path.startsWith("http")
    ? path
    : path.startsWith("/")
      ? path
      : `/${path}`;

  console.log("🚀 Frontend đang gọi chính xác đến:", finalUrl);

  const mergedHeaders = new Headers(API_REQUEST_HEADERS);
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => mergedHeaders.set(k, v));
  }
  mergedHeaders.set("ngrok-skip-browser-warning", "true");

  return fetch(finalUrl, { ...init, headers: mergedHeaders });
}

export async function checkPrice(janCode: string): Promise<CheckPriceResponse> {
  const path = `/api/check?jan=${encodeURIComponent(janCode)}`;
  const response = await apiFetch(path, { method: "GET" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API lỗi ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<CheckPriceResponse>;
}

export async function getTopSearches(): Promise<TopSearch[]> {
  try {
    const response = await apiFetch("/api/top-searches", { method: "GET" });
    if (!response.ok) return [];
    const data = await response.json() as { results: TopSearch[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

export interface PriceMonitorRow {
  id?: number | string;
  product_url: string;
  target_price: number;
  interval_min: number;
  notification_channel?: string;
}

export async function listMonitors(): Promise<PriceMonitorRow[]> {
  const response = await apiFetch("/api/monitors", { method: "GET" });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Danh sách monitor lỗi ${response.status}: ${t}`);
  }
  const data = await response.json() as { monitors?: PriceMonitorRow[] };
  return data.monitors ?? [];
}

export async function createMonitor(payload: {
  product_url: string;
  target_price: number;
  interval_min: number;
  notification_channel?: string;
}): Promise<PriceMonitorRow> {
  const response = await apiFetch("/api/monitors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_url: payload.product_url,
      target_price: payload.target_price,
      interval_min: payload.interval_min,
      notification_channel: payload.notification_channel ?? "push",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    monitor?: PriceMonitorRow;
    error?: string;
    details?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || data.details || `Lỗi ${response.status}`);
  }
  if (!data.monitor) {
    throw new Error("Phản hồi không có monitor");
  }
  return data.monitor;
}

export async function fetchVapidPublicKey(): Promise<{
  configured: boolean;
  publicKey?: string;
  error?: string;
}> {
  const response = await apiFetch("/api/push/vapid-public-key", { method: "GET" });
  return response.json() as Promise<{
    configured: boolean;
    publicKey?: string;
    error?: string;
  }>;
}

export async function postPushSubscription(subscription: object): Promise<void> {
  const response = await apiFetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Lưu subscription lỗi ${response.status}: ${t}`);
  }
}

/** Chuẩn hóa VAPID public key (base64url) → Uint8Array cho PushManager.subscribe */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    out[i] = rawData.charCodeAt(i);
  }
  return out;
}

export interface DiagnosticsResponse {
  ok: boolean;
  timestamp: string;
  supabase: { ok: boolean; detail?: string };
  vapid: { ok: boolean; detail?: string };
  playwright: { ok: boolean; detail?: string };
}

export async function fetchDiagnostics(): Promise<DiagnosticsResponse> {
  const response = await apiFetch("/api/diagnostics", { method: "GET" });
  const data = (await response.json().catch(() => null)) as DiagnosticsResponse | null;
  if (!response.ok || !data || typeof data.ok !== "boolean") {
    throw new Error("Không đọc được diagnostics");
  }
  return data;
}

export interface TestPushResponse {
  ok: boolean;
  detail?: string;
  sent?: number;
  failed?: number;
}

export async function postDiagnosticsTestPush(): Promise<TestPushResponse> {
  const response = await apiFetch("/api/diagnostics/test-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = (await response.json().catch(() => ({}))) as TestPushResponse;
  if (!response.ok && data.detail == null && data.ok == null) {
    throw new Error(`Lỗi ${response.status}`);
  }
  return { ok: Boolean(data.ok), detail: data.detail, sent: data.sent, failed: data.failed };
}

/*
 * Self-check: route khớp 100%
 * Backend  server.js     : app.get("/api/check", ...)
 * Proxy    route.ts      : backendOrigin() + "/api/check" + search
 * Frontend api.ts        : "/api/check?jan=..."
 * Top      route.ts      : backendOrigin() + "/api/top-searches"
 *
 * Test nhanh từ DevTools:
 *   fetch("/api/check?jan=4902370553024").then(r=>r.json()).then(console.log)
 *   fetch("/api/top-searches").then(r=>r.json()).then(console.log)
 */
