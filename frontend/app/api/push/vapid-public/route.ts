import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function backendOrigin(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:3001";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `http://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/+$/, "").replace(/\/api(\/.*)?$/i, "");
  }
}

export async function GET() {
  const target = `${backendOrigin()}/api/push/vapid-public`;
  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[proxy push vapid-public]", err);
    return NextResponse.json({ configured: false, error: "Không kết nối backend" }, { status: 502 });
  }
}
