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

/** Backend / Ngrok — luôn từ process.env.NEXT_PUBLIC_API_URL */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

/** Mọi request tới API (đặc biệt qua Ngrok) phải kèm header này. */
export const API_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

/**
 * fetch() gắn sẵn header Ngrok + Accept JSON.
 * Dùng cho mọi endpoint Backend để tránh HTML cảnh báo Ngrok.
 */
export async function apiFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: HeadersInit }
): Promise<Response> {
  const finalUrl = path.startsWith("http")
    ? path
    : `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  console.log("🚀 Frontend đang gọi đến:", finalUrl);

  const mergedHeaders = new Headers(API_REQUEST_HEADERS);
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => mergedHeaders.set(k, v));
  }
  mergedHeaders.set("ngrok-skip-browser-warning", "true");
  return fetch(finalUrl, {
    ...init,
    headers: mergedHeaders,
  });
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

/*
 * Test nhanh API (JSON thật, không phải HTML cảnh báo Ngrok):
 * - Thanh địa chỉ trình duyệt KHÔNG gửi được custom header → dễ nhầm trang Ngrok.
 * - Mở DevTools (F12) > Console, dán (thay BASE bằng URL Ngrok hoặc http://localhost:3001):
 *   fetch(BASE + "/api/check?jan=4902370553024", { headers: { Accept: "application/json", "ngrok-skip-browser-warning": "true" } }).then(r => r.json()).then(console.log)
 * - Hoặc PowerShell: curl.exe -H "ngrok-skip-browser-warning: true" "BASE/api/check?jan=4902370553024"
 * Kết quả phải là object JSON { jan, results, ... }; nếu thấy HTML interstitial thì thiếu header trên.
 */
