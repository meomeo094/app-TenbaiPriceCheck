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
