import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lấy chỉ origin của backend (protocol + host + port).
 * Bỏ mọi path (/api, /api/check…) để tránh URL thành /api/check/api/check.
 *
 * Thứ tự ưu tiên:
 *   1. BACKEND_URL  (server-only, không expose ra client bundle)
 *   2. NEXT_PUBLIC_API_URL  (fallback nếu chưa set BACKEND_URL)
 *   3. http://127.0.0.1:3001  (local dev)
 */
function backendOrigin(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:3001";

  try {
    const u = new URL(raw.startsWith("http") ? raw : `http://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    // Fallback thô: bỏ trailing slash và bỏ /api... ở cuối
    return raw.replace(/\/+$/, "").replace(/\/api(\/check)?$/i, "");
  }
}

/**
 * GET /api/check?jan=... (Next.js Route Handler — proxy tới Express)
 *
 * Luồng:
 *   Browser → Vercel /api/check → (server) → Express backendOrigin()/api/check → scrapers
 *
 * Tại sao cần proxy này:
 *   - Browser gọi same-origin (không CORS, không cần ngrok header)
 *   - Vercel server mới gọi Ngrok với ngrok-skip-browser-warning
 *   - NEXT_PUBLIC_* không bị leak vào client bundle
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.search; // "?jan=xxx"
  const target = `${backendOrigin()}/api/check${search}`;

  console.log("[proxy] →", target);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy] fetch error:", err);
    return NextResponse.json(
      { error: "Không thể kết nối tới backend", target },
      { status: 502 }
    );
  }

  const body = await upstream.text();

  if (!upstream.ok) {
    console.error(`[proxy] upstream ${upstream.status} — target: ${target}`);
  }

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
