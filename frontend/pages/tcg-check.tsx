"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { identifyTcgCard } from "@/app/lib/api";

interface TcgResult {
  cardName: string | null;
  productCode: string | null;
  setName: string | null;
  centeringLr: { left: number; right: number } | null;
  centeringTb: { top: number; bottom: number } | null;
  centering: string | null;
  psaPrediction: string | null;
}

const COMPRESS_MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

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
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ Canvas.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

/** Snkrdunk: keywords = name + ' ' + card_number */
function buildSnkrdunkUrl(name: string | null, cardNumber: string | null): string {
  return `https://snkrdunk.com/search?keywords=${encodeURIComponent(
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

function formatPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1)}%`;
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
      setError("Vui lòng chọn hoặc chụp ảnh thẻ trước.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await compressImageFileToJpegDataUrl(file);
      const data = await identifyTcgCard(dataUrl);
      if (!data.ok) {
        throw new Error(data.error || "Nhận diện thất bại.");
      }
      setResult({
        cardName: data.name ?? null,
        productCode: data.card_number ?? null,
        setName: data.set_name ?? null,
        centeringLr: data.centering_lr ?? null,
        centeringTb: data.centering_tb ?? null,
        centering: data.centering_estimate ?? null,
        psaPrediction: data.psa_prediction ?? null,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Lỗi không xác định khi phân tích ảnh."
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
          aria-label="Quay lại"
        >
          &larr;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight">Kiểm tra TCG (AI)</h1>
          <p className="text-slate-400 text-xs">Nhận diện thẻ bài — Gemini</p>
        </div>
        <span className="shrink-0 rounded-xl bg-violet-900/60 border border-violet-700/50 px-3 py-1.5 text-xs font-semibold text-violet-300">
          Beta
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-5 max-w-lg mx-auto w-full space-y-6">
        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">1. Tải ảnh thẻ bài</h2>

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
                  alt="Xem trước"
                  className="max-h-52 max-w-full rounded-xl object-contain"
                />
                <p className="text-slate-400 text-xs truncate max-w-[240px]">{fileName}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Chạm để chọn ảnh</p>
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
              Máy ảnh
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
          <h2 className="text-slate-200 text-sm font-semibold">2. Nhận diện AI</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={loading || !preview}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-violet-900/30"
            >
              {loading ? "Đang phân tích..." : "Quét thẻ"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl text-sm"
              >
                Xóa ảnh
              </button>
            )}
          </div>
        </section>

        {result && (
          <section className="space-y-4">
            <h2 className="text-slate-200 text-sm font-semibold">3. Kết quả</h2>

            <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-3">
              <ResultRow label="Tên thẻ" value={result.cardName} />
              <ResultRow label="Mã số thẻ" value={result.productCode} mono />
              <ResultRow label="Bộ thẻ" value={result.setName} />
              {result.centeringLr && (
                <ResultRow
                  label="Căn chỉnh L/R (Trái / Phải)"
                  value={`${formatPct(result.centeringLr.left)} / ${formatPct(result.centeringLr.right)}`}
                />
              )}
              {result.centeringTb && (
                <ResultRow
                  label="Căn chỉnh T/B (Trên / Dưới)"
                  value={`${formatPct(result.centeringTb.top)} / ${formatPct(result.centeringTb.bottom)}`}
                />
              )}
              <ResultRow label="Đánh giá căn chỉnh (PSA style)" value={result.centering} />
              <ResultRow label="Dự đoán PSA (ước lượng)" value={result.psaPrediction} />
            </div>

            {searchQ !== "" && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">
                  Tra cứu giá thực tế
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={buildSnkrdunkUrl(result.cardName, result.productCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Tra cứu giá SNKRDUNK
                  </a>
                  <a
                    href={buildMercariUrl(searchQ)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4 rounded-xl text-sm"
                  >
                    Tra cứu giá Mercari
                  </a>
                </div>
              </div>
            )}
          </section>
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

