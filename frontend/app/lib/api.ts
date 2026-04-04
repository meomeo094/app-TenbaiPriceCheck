export interface PriceResult {
  site: string;
  price: string | null;
  link: string;
  status: "success" | "error" | "not_found";
}

export interface CheckPriceResponse {
  jan: string;
  results: PriceResult[];
  timestamp: string;
}

/** Base URL của Backend (local hoặc Ngrok). Trên Vercel: Settings → Environment Variables → NEXT_PUBLIC_API_URL */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

/** Header bắt buộc cho mọi request qua Ngrok (tránh HTML trang cảnh báo thay vì JSON). */
export const API_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

export async function checkPrice(janCode: string): Promise<CheckPriceResponse> {
  const url = `${API_BASE_URL}/api/check-price?jan=${encodeURIComponent(janCode)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: API_REQUEST_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API lỗi ${response.status}: ${errorText}`);
  }

  return response.json();
}
