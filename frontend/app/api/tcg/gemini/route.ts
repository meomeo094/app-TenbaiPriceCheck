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

export async function POST(req: NextRequest) {
  const target = `${backendOrigin()}/api/tcg/gemini`;
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Cannot read body" }, { status: 400 });
  }
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { ...PROXY_HEADERS },
      body: bodyText.length ? bodyText : "{}",
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[proxy tcg/gemini]", err);
    return NextResponse.json({ ok: false, error: "Backend unreachable" }, { status: 502 });
  }
}
