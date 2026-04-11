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

/** Mọi request tới API (proxy/backend): tránh trang cảnh báo Ngrok làm hỏng JSON + body JSON. */
export const API_REQUEST_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
  Accept: "application/json",
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
  mergedHeaders.set("Content-Type", mergedHeaders.get("Content-Type") || "application/json");

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

export interface DiagnosticsResponse {
  ok: boolean;
  timestamp: string;
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

/** Một dòng tương ứng bảng my_inventory (JAN + giá mua vào). */
export interface InventoryRowInput {
  jan: string;
  purchase_price: number;
  name?: string | null;
}

/** Dòng lưu trên server (file my_inventory.json). */
export interface MyInventoryRow {
  id: string;
  name: string;
  jan: string;
  purchase_price: number;
}

export async function getMyInventory(): Promise<MyInventoryRow[]> {
  const response = await apiFetch("/api/my-inventory", { method: "GET" });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`my-inventory ${response.status}: ${t}`);
  }
  const data = (await response.json()) as { inventory?: MyInventoryRow[] };
  return data.inventory ?? [];
}

export async function saveMyInventory(inventory: MyInventoryRow[]): Promise<MyInventoryRow[]> {
  const response = await apiFetch("/api/my-inventory", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventory }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`my-inventory ${response.status}: ${text}`);
  }
  const data = JSON.parse(text) as { inventory?: MyInventoryRow[] };
  return data.inventory ?? [];
}

export interface CheckProfitRow {
  jan: string;
  name: string | null;
  purchase_price: number | null;
  max_kaitori_price: number | null;
  max_price_site: string | null;
  link: string | null;
  profit: number | null;
  error?: string;
}

export interface CheckProfitResponse {
  timestamp: string;
  results: CheckProfitRow[];
}

export interface TcgIdentifyResponse {
  ok: boolean;
  name?: string | null;
  card_number?: string | null;
  set_name?: string | null;
  centering_estimate?: string | null;
  error?: string;
}

export async function identifyTcgCard(imageBase64: string): Promise<TcgIdentifyResponse> {
  const response = await apiFetch("/api/tcg/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  const text = await response.text();
  let data: TcgIdentifyResponse;
  try {
    data = JSON.parse(text) as TcgIdentifyResponse;
  } catch {
    throw new Error(`tcg/identify ${response.status}: invalid JSON`);
  }
  if (!response.ok) {
    throw new Error(data.error || `tcg/identify ${response.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

export async function checkProfit(
  inventory: InventoryRowInput[]
): Promise<CheckProfitResponse> {
  const response = await apiFetch("/api/check-profit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventory }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`check-profit ${response.status}: ${text}`);
  }
  return JSON.parse(text) as CheckProfitResponse;
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
 *   fetch("/api/check-profit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inventory:[{jan:"4902370553024",purchase_price:1000}]})}).then(r=>r.json()).then(console.log)
 */
