import { NextRequest, NextResponse } from "next/server";

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

const PROXY_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
} as const;

export async function GET() {
  const target = `${backendOrigin()}/api/monitors`;
  try {
    const upstream = await fetch(target, { headers: { ...PROXY_HEADERS }, cache: "no-store" });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[proxy monitors GET]", err);
    return NextResponse.json({ error: "Không kết nối được backend", target }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const target = `${backendOrigin()}/api/monitors`;
  let payload: string;
  try {
    payload = await req.text();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        ...PROXY_HEADERS,
        "Content-Type": "application/json",
      },
      body: payload,
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[proxy monitors POST]", err);
    return NextResponse.json({ error: "Không kết nối được backend", target }, { status: 502 });
  }
}
