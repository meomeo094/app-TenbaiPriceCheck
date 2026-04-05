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

export const API_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

/**
 * Tất cả request đều gọi same-origin /api/check (Next.js proxy → Express).
 * Không ghép BASE_URL vào client — tránh thừa /api, sai origin, biến env không embed.
 */
export async function apiFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: HeadersInit }
): Promise<Response> {
  // same-origin: dùng path tuyệt đối (bắt đầu /) hoặc URL đầy đủ
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
  // Gọi same-origin /api/check — Next.js proxy xử lý, không cần BASE_URL
  const path = `/api/check?jan=${encodeURIComponent(janCode)}`;
  const response = await apiFetch(path, { method: "GET" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API lỗi ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<CheckPriceResponse>;
}

/*
 * Self-check: so sánh route backend vs frontend
 * Backend  server.js : app.get("/api/check", ...)       → Express route
 * Frontend route.ts  : target = backendBase() + "/api/check" + search
 * Frontend api.ts    : path   = "/api/check?jan=..."
 * → 3 chuỗi đều kết thúc tại /api/check — KHỚP 100%
 *
 * Test nhanh từ DevTools Console (tại trang app):
 *   fetch("/api/check?jan=4902370553024").then(r=>r.json()).then(console.log)
 */
