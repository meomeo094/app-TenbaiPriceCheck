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

/**
 * Luôn gọi same-origin `/api/check` (Next.js proxy → Express).
 * Trên Vercel: không phụ thuộc NEXT_PUBLIC_* trong bundle; server đọc BACKEND_URL / NEXT_PUBLIC_API_URL.
 */
const CHECK_PATH_PREFIX = "/api/check";

/** Mọi request tới API (proxy thêm header khi gọi Ngrok từ server). */
export const API_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

function resolveSameOriginUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * fetch same-origin `/api/check` (qua proxy Next.js) hoặc URL tuyệt đối.
 */
export async function apiFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: HeadersInit }
): Promise<Response> {
  const finalUrl = resolveSameOriginUrl(path);
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
  const path = `${CHECK_PATH_PREFIX}?jan=${encodeURIComponent(janCode)}`;
  const response = await apiFetch(path, { method: "GET" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API lỗi ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<CheckPriceResponse>;
}

/*
 * Test nhanh (sau khi bật Backend + Ngrok, đặt BACKEND_URL trên Vercel):
 * - Trình duyệt tại trang app: fetch("/api/check?jan=4902370553024", { headers: { Accept: "application/json", "ngrok-skip-browser-warning": "true" } }).then(r => r.json()).then(console.log)
 */
