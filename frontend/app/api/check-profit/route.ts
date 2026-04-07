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

/**
 * POST /api/check-profit — proxy tới Express (body JSON inventory giống bảng my_inventory).
 */
export async function POST(req: NextRequest) {
  const target = `${backendOrigin()}/api/check-profit`;
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ error: "Không đọc được body" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: bodyText.length ? bodyText : "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy check-profit]", err);
    return NextResponse.json(
      { error: "Không thể kết nối tới backend", target },
      { status: 502 }
    );
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
