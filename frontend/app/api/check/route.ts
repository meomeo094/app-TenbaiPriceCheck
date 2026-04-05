import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function backendBase(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:3001";
  let base = raw.replace(/\/+$/, "");
  if (/\/api$/i.test(base)) base = base.replace(/\/api$/i, "");
  return base;
}

/**
 * Proxy: Browser → same-origin /api/check → (Vercel server) → Express BACKEND_URL/api/check
 * Tránh lỗi NEXT_PUBLIC_* không khớp build / BASE_URL thừa /api → 404 trên Express.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.search;
  const target = `${backendBase()}/api/check${search}`;

  const upstream = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
