import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Chỉ lấy origin (protocol + host [+ port]), bỏ mọi path.
 * Tránh lỗi khi Sếp dán https://xxx.ngrok-free.dev/api hoặc .../api/check
 * → proxy gọi .../api/check/api/check → Express 404.
 */
function backendBase(): string {
  let raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:3001";
  try {
    if (!/^https?:\/\//i.test(raw)) {
      raw = `http://${raw}`;
    }
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/+$/, "").replace(/\/api(?:\/check)?$/i, "");
  }
}

/**
 * Proxy: Browser → same-origin /api/check → (Vercel server) → Express BACKEND_URL/api/check
 * Tránh lỗi NEXT_PUBLIC_* không khớp build / BASE_URL thừa /api → 404 trên Express.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.search;
  const target = `${backendBase()}/api/check${search}`;

  if (process.env.NODE_ENV === "development") {
    console.log("[proxy /api/check] →", target);
  }

  const upstream = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    console.error("[proxy /api/check] upstream", upstream.status, "target=", target);
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
