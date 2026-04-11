"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { identifyTcgCard } from "@/app/lib/api";

interface TcgResult {
  cardName: string | null;
  productCode: string | null;
  setName: string | null;
  centering: string | null;
}

const COMPRESS_MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Gi\u1ea3m chi\u1ec1u r\u1ed9ng t\u1ed1i \u0111a 1200px + JPEG quality 0.8 (n\u00e9t, v\u1eabn nh\u1eb9).
 */
async function compressImageFileToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > COMPRESS_MAX_WIDTH) {
      h = Math.round((h * COMPRESS_MAX_WIDTH) / w);
      w = COMPRESS_MAX_WIDTH;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Tr\u00ecnh duy\u1ec7t kh\u00f4ng h\u1ed7 tr\u1ee3 Canvas.");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

/** Snkrdunk: \u0111\u00fang c\u00f4ng th\u1ee9c keyword = name + ' ' + card_number */
function buildSnkrdunkUrl(name: string | null, cardNumber: string | null): string {
  return `https://snkrdunk.com/search?keyword=${encodeURIComponent(
    `${name ?? ""} ${cardNumber ?? ""}`.trim()
  )}`;
}

function buildMercariUrl(q: string) {
  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(q)}&status=on_sale`;
}

function buildSearchKeyword(name: string | null, code: string | null): string {
  const parts = [name?.trim(), code?.trim()].filter(Boolean) as string[];
  return parts.join(" ").trim();
}

export default function TcgCheckPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TcgResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const handleAnalyze = async () => {
    const file =
      fileInputRef.current?.files?.[0] ?? cameraInputRef.current?.files?.[0] ?? null;
    if (!file) {
      setError("Vui l\u00f2ng ch\u1ecdn ho\u1eb7c ch\u1ee5p \u1ea3nh th\u1ebb tr\u01b0\u1edbc.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await compressImageFileToJpegDataUrl(file);
      const data = await identifyTcgCard(dataUrl);
      if (!data.ok) {
        throw new Error(data.error || "Nh\u1eadn di\u1ec7n th\u1ea5t b\u1ea1i.");
      }

      setResult({
        cardName: data.name ?? null,
        productCode: data.card_number ?? null,
        setName: data.set_name ?? null,
        centering: data.centering_estimate ?? null,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "L\u1ed7i kh\u00f4ng x\u00e1c \u0111\u1ecbnh khi ph\u00e2n t\u00edch \u1ea3nh."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const searchQ = result ? buildSearchKeyword(result.cardName, result.productCode) : "";

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border border-slate-700 active:bg-slate-700"
          aria-label="Quay l\u1ea1i"
        >
          &larr;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight">Ki\u1ec3m tra TCG (AI)</h1>
          <p className="text-slate-400 text-xs">Nh\u1eadn di\u1ec7n th\u1ebb b\u00e0i \u2014 Gemini</p>
        </div>
        <span className="shrink-0 rounded-xl bg-violet-900/60 border border-violet-700/50 px-3 py-1.5 text-xs font-semibold text-violet-300">
          Beta
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-5 max-w-lg mx-auto w-full space-y-6">
        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">
            1. T\u1ea3i \u1ea3nh th\u1ebb b\u00e0i
          </h2>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/30 min-h-[200px] flex flex-col items-center justify-center gap-4 transition-colors hover:border-violet-600 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Xem tr\u01b0\u1edbc"
                  className="max-h-52 max-w-full rounded-xl object-contain"
                />
                <p className="text-slate-400 text-xs truncate max-w-[240px]">{fileName}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Ch\u1ea1m \u0111\u1ec3 ch\u1ecdn \u1ea3nh</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-xl"
            >
              M\u00e1y \u1ea3nh
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-xl"
            >
              Album
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
          />

          {error && (
            <p className="text-red-400 text-sm rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2">
              {error}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">2. Nh\u1eadn di\u1ec7n AI</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={loading || !preview}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-violet-900/30"
            >
              {loading ? "\u0110ang ph\u00e2n t\u00edch..." : "Qu\u00e9t th\u1ebb"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl text-sm"
              >
                X\u00f3a \u1ea3nh
              </button>
            )}
          </div>
        </section>

        {result && (
          <section className="space-y-4">
            <h2 className="text-slate-200 text-sm font-semibold">3. K\u1ebft qu\u1ea3</h2>

            <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-3">
              <ResultRow label="T\u00ean th\u1ebb" value={result.cardName} />
              <ResultRow label="M\u00e3 s\u1ed1 th\u1ebb" value={result.productCode} mono />
              <ResultRow label="B\u1ed9 th\u1ebb" value={result.setName} />
              <ResultRow label="\u0110\u00e1nh gi\u00e1 c\u0103n ch\u1ec9nh" value={result.centering} />
            </div>

            {searchQ !== "" && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">
                  Tra c\u1ee9u gi\u00e1 th\u1ef1c t\u1ebf
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={buildSnkrdunkUrl(result.cardName, result.productCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Tra c\u1ee9u gi\u00e1 SNKRDUNK
                  </a>
                  <a
                    href={buildMercariUrl(searchQ)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Tra c\u1ee9u gi\u00e1 Mercari
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {!result && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-slate-400 text-sm">
            <p>
              {
                "\u1ea2nh \u0111\u01b0\u1ee3c n\u00e9n (t\u1ed1i \u0111a 1200px, JPEG 80%) r\u1ed3i g\u1eedi t\u1edbi "
              }
              <code className="text-xs bg-slate-700 px-1 rounded">POST /api/tcg/identify</code>
              {". C\u1ea7n "}
              <code className="text-violet-300 text-xs bg-slate-700 px-1 rounded">GEMINI_API_KEY</code>
              {" trong "}
              <code className="text-xs bg-slate-700 px-1 rounded">backend/.env</code>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function ResultRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-slate-400 text-xs mb-0.5">{label}</p>
      <p
        className={`text-white text-sm font-medium break-all ${mono ? "font-mono text-violet-300" : ""}`}
      >
        {value ?? "\u2014"}
      </p>
    </div>
  );
}
