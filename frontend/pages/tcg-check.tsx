"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { identifyTcgCard, TcgIdentifyError } from "@/app/lib/api";

interface TcgResult {
  cardName: string | null;
  productCode: string | null;
  setName: string | null;
  centering: string | null;
}

function buildSnkrdunkUrl(q: string) {
  return `https://snkrdunk.com/search?keyword=${encodeURIComponent(q)}`;
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
  const [errorKind, setErrorKind] = useState<"rateLimit" | "generic" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setErrorKind(null);
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
      setError("Vui long chon hoac chup anh the bai truoc.");
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    setResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Khong doc duoc anh."));
        reader.readAsDataURL(file);
      });

      const data = await identifyTcgCard(dataUrl);
      if (!data.ok) {
        throw new Error(data.error || "Nhan dien that bai.");
      }

      setResult({
        cardName: data.name ?? null,
        productCode: data.card_number ?? null,
        setName: data.set_name ?? null,
        centering: data.centering_estimate ?? null,
      });
    } catch (e) {
      if (e instanceof TcgIdentifyError && e.rateLimited) {
        setErrorKind("rateLimit");
        setError(
          e.message ||
            "Google \u0111ang b\u1eadn x\u1eed l\u00fd, s\u1ebfp vui l\u00f2ng \u0111\u1ee3i 20 gi\u00e2y r\u1ed3i th\u1eed l\u1ea1i nh\u00e9!"
        );
      } else {
        setErrorKind("generic");
        setError(e instanceof Error ? e.message : "Loi khong xac dinh khi phan tich anh.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setFileName(null);
    setResult(null);
    setError(null);
    setErrorKind(null);
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
          aria-label="Back"
        >
          &larr;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight">Check TCG (AI)</h1>
          <p className="text-slate-400 text-xs">Gemini 1.5 Flash</p>
        </div>
        <span className="shrink-0 rounded-xl bg-violet-900/60 border border-violet-700/50 px-3 py-1.5 text-xs font-semibold text-violet-300">
          Beta
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-5 max-w-lg mx-auto w-full space-y-6">
        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">1. Upload</h2>

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
                  alt="Preview"
                  className="max-h-52 max-w-full rounded-xl object-contain"
                />
                <p className="text-slate-400 text-xs truncate max-w-[240px]">{fileName}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Tap to choose image</p>
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
              Camera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-xl"
            >
              Gallery
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
            <p
              className={
                errorKind === "rateLimit"
                  ? "text-amber-200 text-sm rounded-xl border border-amber-500/40 bg-amber-950/35 px-4 py-2"
                  : "text-red-400 text-sm rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2"
              }
            >
              {error}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">2. AI</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={loading || !preview}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-violet-900/30"
            >
              {loading ? "Analyzing..." : "Scan card"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {result && (
          <section className="space-y-4">
            <h2 className="text-slate-200 text-sm font-semibold">3. Result</h2>

            <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-3">
              <ResultRow label="Name" value={result.cardName} />
              <ResultRow label="Card number" value={result.productCode} mono />
              <ResultRow label="Set" value={result.setName} />
              <ResultRow label="Centering" value={result.centering} />
            </div>

            {searchQ !== "" && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  Price links
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={buildSnkrdunkUrl(searchQ)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Xem gia tren Snkrdunk
                  </a>
                  <a
                    href={buildMercariUrl(searchQ)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Xem gia tren Mercari
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {!result && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-slate-400 text-sm">
            <p>
              Images are sent to <code className="text-xs bg-slate-700 px-1 rounded">POST /api/tcg/identify</code>{" "}
              (Next.js proxy to backend). Set <code className="text-violet-300 text-xs bg-slate-700 px-1 rounded">GEMINI_API_KEY</code> in{" "}
              <code className="text-xs bg-slate-700 px-1 rounded">backend/.env</code>.
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
        {value ?? "—"}
      </p>
    </div>
  );
}
