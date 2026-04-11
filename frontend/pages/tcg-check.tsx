"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

interface TcgResult {
  cardName: string | null;
  productCode: string | null;
  centering: string | null;
  rawText?: string;
}

function buildSnkrdunkUrl(code: string) {
  return `https://snkrdunk.com/search?keyword=${encodeURIComponent(code)}`;
}
function buildMercariUrl(code: string) {
  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(code)}&status=on_sale`;
}
function buildYahooUrl(code: string) {
  return `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(code)}`;
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
    const url = URL.createObjectURL(file);
    setPreview(url);
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
    if (!fileInputRef.current?.files?.[0] && !cameraInputRef.current?.files?.[0]) {
      setError("Vui lòng chọn hoặc chụp ảnh thẻ bài trước.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Stub: gọi API backend khi Gemini đã được triển khai
      await new Promise((r) => setTimeout(r, 1200));
      // TODO: thay bằng fetch("/api/tcg/analyze", { method: "POST", body: formData })
      setResult({
        cardName: "Pikachu (Base Set)",
        productCode: "PIKA-001",
        centering: "60/40 (Near Mint)",
        rawText: "[Stub] Chưa kết nối Gemini API — kết quả mẫu để kiểm tra UI.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định khi phân tích ảnh.");
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

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border border-slate-700 active:bg-slate-700"
          aria-label="Về trang chủ"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight">Check TCG (AI)</h1>
          <p className="text-slate-400 text-xs">Nhận diện thẻ bài bằng Gemini 1.5 Flash</p>
        </div>
        <span className="shrink-0 rounded-xl bg-violet-900/60 border border-violet-700/50 px-3 py-1.5 text-xs font-semibold text-violet-300">
          Beta
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-5 max-w-lg mx-auto w-full space-y-6">
        {/* Upload / Camera area */}
        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">1. Chọn ảnh thẻ bài</h2>

          {/* Drop zone */}
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
                  alt="Preview thẻ bài"
                  className="max-h-52 max-w-full rounded-xl object-contain"
                />
                <p className="text-slate-400 text-xs truncate max-w-[240px]">{fileName}</p>
              </>
            ) : (
              <>
                <div className="text-5xl">🃏</div>
                <div className="text-center">
                  <p className="text-slate-300 text-sm font-medium">
                    Kéo & thả ảnh vào đây
                  </p>
                  <p className="text-slate-500 text-xs mt-1">hoặc nhấn để chọn file</p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              <span className="text-lg">📷</span>
              Chụp ảnh
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              <span className="text-lg">🖼️</span>
              Chọn file
            </button>
          </div>

          {/* Hidden camera input */}
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

        {/* Analyze button */}
        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">2. Phân tích bằng AI</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={loading || !preview}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-colors text-base shadow-lg shadow-violet-900/30"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang phân tích…
                </>
              ) : (
                <>
                  <span className="text-lg">🤖</span>
                  Nhận diện thẻ
                </>
              )}
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors text-sm"
              >
                Xóa
              </button>
            )}
          </div>
        </section>

        {/* Result */}
        {result && (
          <section className="space-y-4">
            <h2 className="text-slate-200 text-sm font-semibold">3. Kết quả nhận diện</h2>

            <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-3">
              <ResultRow label="Tên thẻ" value={result.cardName} icon="🃏" />
              <ResultRow label="Mã sản phẩm" value={result.productCode} icon="🔢" mono />
              <ResultRow label="Centering" value={result.centering} icon="📐" />
              {result.rawText && (
                <div className="pt-2 border-t border-violet-800/40">
                  <p className="text-slate-500 text-xs">{result.rawText}</p>
                </div>
              )}
            </div>

            {/* Quick search links */}
            {result.productCode && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  Tìm nhanh theo mã
                </p>
                <div className="flex flex-col gap-2">
                  <ExternalLink
                    href={buildSnkrdunkUrl(result.productCode)}
                    label="Tìm trên Snkrdunk"
                    color="bg-orange-600 hover:bg-orange-500"
                    icon="🛒"
                  />
                  <ExternalLink
                    href={buildMercariUrl(result.productCode)}
                    label="Tìm trên Mercari JP"
                    color="bg-red-600 hover:bg-red-500"
                    icon="🏪"
                  />
                  <ExternalLink
                    href={buildYahooUrl(result.productCode)}
                    label="Tìm trên Yahoo Auctions"
                    color="bg-slate-700 hover:bg-slate-600"
                    icon="⚡"
                  />
                </div>
              </div>
            )}

            {result.cardName && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  Tìm nhanh theo tên
                </p>
                <div className="flex flex-col gap-2">
                  <ExternalLink
                    href={buildMercariUrl(result.cardName)}
                    label={`Mercari: "${result.cardName}"`}
                    color="bg-red-600 hover:bg-red-500"
                    icon="🏪"
                  />
                  <ExternalLink
                    href={buildYahooUrl(result.cardName)}
                    label={`Yahoo: "${result.cardName}"`}
                    color="bg-slate-700 hover:bg-slate-600"
                    icon="⚡"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Stub notice */}
        {!result && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-slate-400 text-sm space-y-2">
            <p className="font-medium text-slate-300">📌 Về tính năng này</p>
            <p>
              AI nhận diện thẻ bài dùng <strong className="text-violet-400">Gemini 1.5 Flash</strong>.
              Sau khi cấu hình{" "}
              <code className="text-violet-300 text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                GEMINI_API_KEY
              </code>{" "}
              trong <code className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">backend/.env</code>,
              tính năng sẽ hoạt động đầy đủ.
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
  icon,
  mono = false,
}: {
  label: string;
  value: string | null;
  icon: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl w-7 flex-shrink-0 text-center">{icon}</span>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs mb-0.5">{label}</p>
        <p
          className={`text-white text-sm font-medium break-all ${mono ? "font-mono text-violet-300" : ""}`}
        >
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

function ExternalLink({
  href,
  label,
  color,
  icon,
}: {
  href: string;
  label: string;
  color: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 ${color} text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm`}
    >
      <span>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-white/60 text-xs">↗</span>
    </a>
  );
}
