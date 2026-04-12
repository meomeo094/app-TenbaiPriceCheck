"use client";

import type { CSSProperties } from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  checkPrice,
  type CheckPriceResponse,
  type PriceResult,
  identifyTcgCard,
  getMyInventory,
  saveMyInventory,
  checkProfit,
  getTopSearches,
  type TopSearch,
  type MyInventoryRow,
  type CheckProfitRow,
} from "./lib/api";
import { useHistory } from "./hooks/useHistory";
import { KachiBrandLogo } from "./components/KachiBrandLogo";
import {
  Search,
  ScanLine,
  Package,
  Sparkles,
  Camera,
  ImageIcon,
  TrendingUp,
  Trash2,
  Plus,
  ChevronRight,
  Zap,
  RotateCcw,
  Tag,
  User,
  BarChart2,
  Clock,
  Star,
  ExternalLink,
  AlertCircle,
  Wallet,
  AlertTriangle,
} from "lucide-react";

const JanScanner = dynamic(() => import("./components/JanScanner"), {
  ssr: false,
});

type Tab = "check" | "tcg" | "vault";

// ─── Image compression ──────────────────────────────────────────────────────
const COMPRESS_MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

async function compressImageToBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width,
      h = bitmap.height;
    if (w > COMPRESS_MAX_WIDTH) {
      h = Math.round((h * COMPRESS_MAX_WIDTH) / w);
      w = COMPRESS_MAX_WIDTH;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? String(Math.round(r)) : r.toFixed(1)}%`;
}

function buildSnkrdunkUrl(
  name: string | null,
  code: string | null
): string {
  return `https://snkrdunk.com/search?keywords=${encodeURIComponent(
    `${name ?? ""} ${code ?? ""}`.trim()
  )}`;
}

function buildMercariUrl(q: string) {
  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(
    q
  )}&status=on_sale`;
}

// ─── Color map for price sites ───────────────────────────────────────────────
const SITE_COLORS: Record<string, string> = {
  Wiki: "from-violet-500/10 to-purple-500/5 border-violet-500/20",
  "1-chome": "from-sky-500/10 to-cyan-500/5 border-sky-500/20",
  Homura: "from-orange-500/10 to-amber-500/5 border-orange-500/20",
  MoriMori: "from-emerald-500/10 to-teal-500/5 border-emerald-500/20",
};

const SITE_DOT: Record<string, string> = {
  Wiki: "bg-violet-400",
  "1-chome": "bg-sky-400",
  Homura: "bg-orange-400",
  MoriMori: "bg-emerald-400",
};

// ─── TAB 1: Market Check ────────────────────────────────────────────────────
function MarketCheckTab() {
  const [janCode, setJanCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CheckPriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TopSearch[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, addEntry, clearHistory } = useHistory();

  useEffect(() => {
    getTopSearches()
      .then(setTrending)
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setIsLoading(true);
      setError(null);
      setResults(null);
      try {
        const data = await checkPrice(trimmed);
        setResults(data);
        const successResults = data.results.filter(
          (r) => r.status === "success" && r.price
        );
        const best = [...successResults].sort(
          (a, b) => parseInt(b.price ?? "0") - parseInt(a.price ?? "0")
        )[0];
        addEntry({
          jan: data.jan,
          name: data.results.find((r) => r.name)?.name ?? null,
          highestPrice: best ? parseInt(best.price!, 10) : null,
          highestSite: best?.site ?? null,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [addEntry]
  );

  const handleScanSuccess = useCallback(
    (code: string) => {
      setIsScanning(false);
      setJanCode(code);
      handleSearch(code);
    },
    [handleSearch]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(janCode);
  };

  const handleClear = () => {
    setJanCode("");
    setResults(null);
    setError(null);
    inputRef.current?.focus();
  };

  const sortedResults = results?.results
    ? [...results.results].sort((a, b) => {
        const pa = a.price ? parseInt(a.price.replace(/\D/g, ""), 10) : -1;
        const pb = b.price ? parseInt(b.price.replace(/\D/g, ""), 10) : -1;
        return pb - pa;
      })
    : [];

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        <div className="px-4 max-w-lg mx-auto w-full space-y-6">
          {/* Hero — branding lives in app header; tab opens on title + actions */}
          <div className="flex flex-col items-center text-center pt-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Check giá
            </h1>
            <p className="text-[#8B8FA8] text-sm mt-1">
              So sánh giá thu mua từ nhiều hệ thống
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={janCode}
                onChange={(e) => setJanCode(e.target.value)}
                placeholder="Nhập mã JAN / Barcode..."
                inputMode="numeric"
                className="w-full rounded-2xl px-4 py-4 pr-12 text-white placeholder-[#5A5F72] text-base outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(123,97,255,0.5)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(123,97,255,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {janCode ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5F72] hover:text-white transition-colors p-1.5"
                >
                  <RotateCcw size={16} />
                </button>
              ) : (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5F72]">
                  <ScanLine size={20} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="flex items-center justify-center gap-2.5 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-white"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <ScanLine size={18} />
                <span>Quét mã</span>
              </button>

              <button
                type="submit"
                disabled={!janCode.trim() || isLoading}
                className="flex items-center justify-center gap-2.5 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isLoading
                    ? "rgba(123,97,255,0.5)"
                    : "#7B61FF",
                  boxShadow: !isLoading && janCode.trim()
                    ? "0 0 20px rgba(123,97,255,0.35)"
                    : "none",
                }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search size={18} />
                )}
                <span>{isLoading ? "Đang tìm..." : "Tìm giá"}</span>
              </button>
            </div>
          </form>

          {/* Trending */}
          {trending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-[#00D084]" />
                <span className="text-xs font-semibold tracking-widest text-[#8B8FA8] uppercase">
                  Xu hướng tìm kiếm
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trending.slice(0, 6).map((item) => (
                  <button
                    key={item.jan}
                    onClick={() => {
                      setJanCode(item.jan);
                      handleSearch(item.jan);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-sm text-white transition-all active:scale-95"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {item.name ?? item.jan}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 animate-pulse"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/5 rounded-full w-24" />
                      <div className="h-5 bg-white/5 rounded-full w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium text-sm">
                  Không thể kết nối Backend
                </p>
                <p className="text-red-400/60 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[#8B8FA8] text-xs">
                  Kết quả cho{" "}
                  <span className="font-mono text-[#7B61FF] font-bold">
                    {results.jan}
                  </span>
                </p>
                <span className="text-xs text-[#5A5F72]">
                  {new Date(results.timestamp).toLocaleTimeString("vi-VN")}
                </span>
              </div>

              {sortedResults.map((result: PriceResult, index: number) => {
                const isSuccess = result.status === "success" && result.price;
                const colorClass =
                  SITE_COLORS[result.site] ||
                  "from-white/5 to-white/2 border-white/10";
                const dotClass =
                  SITE_DOT[result.site] || "bg-slate-400";
                return (
                  <div
                    key={result.site}
                    className={`relative bg-gradient-to-br ${colorClass} border rounded-2xl p-4 transition-all active:scale-[0.98]`}
                  >
                    {index === 0 && isSuccess && (
                      <div
                        className="absolute -top-2 -right-2 text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          background: "#F59E0B",
                          color: "#0B0E14",
                        }}
                      >
                        Cao nhất
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#8B8FA8] font-medium mb-0.5">
                            {result.site}
                          </p>
                          {result.name && (
                            <p className="text-white/70 text-xs line-clamp-1 mb-1">
                              {result.name}
                            </p>
                          )}
                          {isSuccess ? (
                            <p className="text-xl font-bold text-white">
                              ¥
                              {Number(
                                result.price?.replace(/\D/g, "")
                              ).toLocaleString("ja-JP")}
                            </p>
                          ) : result.status === "not_found" ? (
                            <p className="text-[#5A5F72] text-sm">
                              Không tìm thấy
                            </p>
                          ) : (
                            <p className="text-red-400/70 text-sm">Lỗi kết nối</p>
                          )}
                        </div>
                      </div>
                      <a
                        href={result.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span>Xem</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                );
              })}

              {sortedResults.every((r) => r.status !== "success") && (
                <div className="text-center py-10">
                  <Search size={36} className="text-[#5A5F72] mx-auto mb-3" />
                  <p className="text-[#8B8FA8]">
                    Không tìm thấy giá cho mã JAN này
                  </p>
                  <p className="text-[#5A5F72] text-sm mt-1">
                    Thử kiểm tra lại mã vạch
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!results && !isLoading && !error && (
            <div className="text-center py-10">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(123,97,255,0.1)" }}
              >
                <BarChart2 size={28} className="text-[#7B61FF]" />
              </div>
              <p className="text-white font-medium">Nhập hoặc quét mã JAN</p>
              <p className="text-[#5A5F72] text-sm mt-1">
                So sánh giá thu mua từ nhiều hệ thống Nhật Bản
              </p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-[#8B8FA8]" />
                  <span className="text-xs font-semibold tracking-widest text-[#8B8FA8] uppercase">
                    Lịch sử
                  </span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-[#5A5F72] hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Xóa tất cả
                </button>
              </div>

              {historyExpanded && (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <button
                      key={entry.jan + entry.time}
                      onClick={() => {
                        setJanCode(entry.jan);
                        handleSearch(entry.jan);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all active:scale-[0.98]"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ background: "rgba(123,97,255,0.12)" }}
                      >
                        <Tag size={16} className="text-[#7B61FF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {entry.name && (
                          <p className="text-white text-sm font-medium truncate">
                            {entry.name}
                          </p>
                        )}
                        <p className="text-[#5A5F72] text-xs font-mono">
                          JAN: {entry.jan}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.highestPrice != null && (
                          <p className="text-[#00D084] text-sm font-bold">
                            ¥{entry.highestPrice.toLocaleString("ja-JP")}
                          </p>
                        )}
                        <p className="text-[#5A5F72] text-xs mt-0.5">
                          {entry.time}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-[#5A5F72] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setHistoryExpanded((v) => !v)}
                className="w-full mt-2 text-center text-xs text-[#5A5F72] hover:text-white py-2 flex items-center justify-center gap-1 transition-colors"
              >
                {historyExpanded ? "Thu gọn lịch sử" : "Xem lịch sử"}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${historyExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {isScanning && (
        <JanScanner
          onScan={handleScanSuccess}
          onClose={() => setIsScanning(false)}
        />
      )}
    </>
  );
}

// ─── TAB 2: TCG AI Scanner ──────────────────────────────────────────────────
interface TcgResult {
  cardName: string | null;
  productCode: string | null;
  setName: string | null;
  centeringLr: { left: number; right: number } | null;
  centeringTb: { top: number; bottom: number } | null;
  centering: string | null;
  psaPrediction: string | null;
}

function TcgScannerTab() {
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
      fileInputRef.current?.files?.[0] ??
      cameraInputRef.current?.files?.[0] ??
      null;
    if (!file) {
      setError("Vui lòng chọn hoặc chụp ảnh thẻ trước.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await compressImageToBase64(file);
      const data = await identifyTcgCard(dataUrl);
      if (!data.ok) throw new Error(data.error || "Nhận diện thất bại.");
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
        e instanceof Error
          ? e.message
          : "Lỗi không xác định khi phân tích ảnh."
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

  const searchQ = result
    ? [result.cardName?.trim(), result.productCode?.trim()]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="flex-1 overflow-y-auto pb-24 pt-4">
      <div className="px-4 max-w-lg mx-auto w-full space-y-6">
        {/* Header — căn giữa */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Check TCG</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">
            Định giá thẻ bài chính xác để tối ưu lợi nhuận kinh doanh
          </p>
        </div>

        {/* Upload section */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div
              className="w-1 h-4 rounded-full shrink-0"
              style={{ background: "#7B61FF" }}
            />
            <span className="text-xs font-semibold tracking-widest text-[#8B8FA8] uppercase">
              Tải ảnh thẻ bài
            </span>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="relative rounded-3xl min-h-[220px] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
            style={{
              background: preview
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.02)",
              border: preview
                ? "1px solid rgba(123,97,255,0.3)"
                : "2px dashed rgba(255,255,255,0.1)",
            }}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Xem trước"
                  className="max-h-48 max-w-full rounded-2xl object-contain"
                />
                {fileName && (
                  <p className="text-[#5A5F72] text-xs truncate max-w-[200px]">
                    {fileName}
                  </p>
                )}
              </>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(123,97,255,0.1)" }}
                >
                  <ImageIcon size={28} className="text-[#7B61FF]" />
                </div>
                <p className="text-white font-medium">Chạm để chọn ảnh</p>
                <p className="text-[#5A5F72] text-xs">
                  Hỗ trợ JPG, PNG, WEBP
                </p>
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

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl text-white transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Camera size={18} />
              <span>Máy ảnh</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl text-white transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ImageIcon size={18} />
              <span>Album</span>
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
        </div>

        {/* AI Section */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div
              className="w-1 h-4 rounded-full shrink-0"
              style={{ background: "#00D084" }}
            />
            <span className="text-xs font-semibold tracking-widest text-[#8B8FA8] uppercase">
              Nhận diện AI
            </span>
          </div>

          {!preview && (
            <div
              className="rounded-3xl p-5 mb-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(123,97,255,0.15)" }}
                >
                  <Sparkles size={18} className="text-[#7B61FF]" />
                </div>
                <p className="text-[#8B8FA8] text-sm leading-relaxed">
                  Hệ thống AI phân tích tình trạng thẻ và đối chiếu giá thị
                  trường thực tế giúp tối ưu hóa lợi nhuận.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3 mb-4"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2.5 font-bold py-4 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "#7B61FF",
                boxShadow: loading
                  ? "none"
                  : "0 0 24px rgba(123,97,255,0.4)",
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ScanLine size={18} />
              )}
              <span>
                {loading ? "Đang phân tích..." : "Quét thẻ"}
              </span>
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-4 rounded-2xl text-[#8B8FA8] hover:text-white transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>

          {/* Lưu ý — thay thế stats độ chính xác / tốc độ */}
          <div
            className="rounded-2xl p-4 mt-4 flex gap-3 items-start"
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.28)",
            }}
          >
            <AlertTriangle
              size={18}
              className="text-amber-400 flex-shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="text-amber-100/90 text-sm leading-relaxed">
              Lưu ý: Độ chính xác không phải 100%, tất cả chỉ là tham khảo.
            </p>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div
            className="rounded-3xl p-5 space-y-4"
            style={{
              background: "rgba(123,97,255,0.06)",
              border: "1px solid rgba(123,97,255,0.2)",
            }}
          >
            <div className="flex items-center gap-2">
              <Star size={16} className="text-[#7B61FF]" />
              <h2 className="text-white font-semibold text-sm">
                Kết quả nhận diện
              </h2>
            </div>

            <div className="space-y-3">
              <TcgResultRow label="Tên thẻ" value={result.cardName} />
              <TcgResultRow
                label="Mã số thẻ"
                value={result.productCode}
                mono
              />
              <TcgResultRow label="Bộ thẻ" value={result.setName} />
              {result.centeringLr && (
                <TcgResultRow
                  label="Căn chỉnh L/R"
                  value={`${formatPct(result.centeringLr.left)} / ${formatPct(result.centeringLr.right)}`}
                />
              )}
              {result.centeringTb && (
                <TcgResultRow
                  label="Căn chỉnh T/B"
                  value={`${formatPct(result.centeringTb.top)} / ${formatPct(result.centeringTb.bottom)}`}
                />
              )}
              <TcgResultRow
                label="Đánh giá căn chỉnh"
                value={result.centering}
                stacked
              />
              <TcgResultRow
                label="Dự đoán PSA"
                value={result.psaPrediction}
                highlight
                stacked
              />
            </div>

            {searchQ && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-[#5A5F72] text-xs uppercase tracking-wide font-medium">
                  Tra cứu giá thực tế
                </p>
                <a
                  href={buildSnkrdunkUrl(
                    result.cardName,
                    result.productCode
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <span>SNKRDUNK</span>
                  <ExternalLink size={14} className="text-amber-400" />
                </a>
                <a
                  href={buildMercariUrl(searchQ)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.25)",
                  }}
                >
                  <span>Mercari JP</span>
                  <ExternalLink size={14} className="text-red-400" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TcgResultRow({
  label,
  value,
  mono = false,
  highlight = false,
  stacked = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  highlight?: boolean;
  /** Label trên, nội dung full width bên dưới (Đánh giá căn chỉnh / Dự đoán PSA) */
  stacked?: boolean;
}) {
  const longTextStyle: CSSProperties = {
    overflowWrap: "break-word",
    wordBreak: "normal",
    hyphens: "none",
  };

  if (stacked) {
    return (
      <div className="w-full flex flex-col gap-2">
        <p className="text-[#5A5F72] text-xs font-medium leading-snug">
          {label}
        </p>
        <p
          className={`w-full text-sm font-medium text-left leading-relaxed break-words hyphens-none ${
            highlight ? "text-[#00D084]" : "text-white"
          }`}
          style={longTextStyle}
        >
          {value ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 w-full">
      <p className="text-[#5A5F72] text-xs mt-0.5 flex-shrink-0">{label}</p>
      <p
        className={`text-sm font-medium text-right min-w-0 max-w-[65%] sm:max-w-[70%] break-words hyphens-none ${
          mono ? "font-mono text-[#7B61FF]" : highlight ? "text-[#00D084]" : "text-white"
        }`}
        style={longTextStyle}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

// ─── TAB 3: Vault / Inventory ────────────────────────────────────────────────
function VaultTab() {
  const [items, setItems] = useState<MyInventoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [jan, setJan] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [profitRows, setProfitRows] = useState<CheckProfitRow[] | null>(null);
  const [profitMeta, setProfitMeta] = useState<string | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitError, setProfitError] = useState<string | null>(null);
  const [showProfitDetails, setShowProfitDetails] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getMyInventory();
      setItems(data);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Không tải được kho hàng."
      );
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: MyInventoryRow[]) => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = await saveMyInventory(next);
      setItems(saved);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const janTrim = jan.trim();
    const priceNum = parseInt(purchasePrice.replace(/\D/g, ""), 10);
    if (!/^\d{8,14}$/.test(janTrim)) {
      setFormError("Mã JAN cần 8–14 chữ số.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setFormError("Giá mua không hợp lệ.");
      return;
    }
    const row: MyInventoryRow = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `id_${Date.now()}`,
      name: name.trim(),
      jan: janTrim,
      purchase_price: priceNum,
    };
    await persist([...items, row]);
    setName("");
    setJan("");
    setPurchasePrice("");
  };

  const handleRemove = async (id: string) => {
    await persist(items.filter((x) => x.id !== id));
    setProfitRows(null);
    setProfitMeta(null);
  };

  const handleCheckProfit = async () => {
    if (items.length === 0) {
      setProfitError("Chưa có sản phẩm trong kho.");
      return;
    }
    setProfitLoading(true);
    setProfitError(null);
    setProfitRows(null);
    setProfitMeta(null);
    try {
      const payload = items.map((r) => ({
        jan: r.jan,
        purchase_price: r.purchase_price,
        name: r.name || null,
      }));
      const data = await checkProfit(payload);
      setProfitRows(data.results);
      setProfitMeta(data.timestamp);
      setShowProfitDetails(true);
    } catch (e) {
      setProfitError(e instanceof Error ? e.message : "Lỗi khi quét giá.");
    } finally {
      setProfitLoading(false);
    }
  };

  const totalPurchase = items.reduce(
    (sum, item) => sum + item.purchase_price,
    0
  );

  const totalCurrentValue =
    profitRows
      ?.reduce(
        (sum, r) => sum + (r.max_kaitori_price ?? r.purchase_price ?? 0),
        0
      ) ?? totalPurchase;

  const profitPercent =
    totalPurchase > 0
      ? Math.round(((totalCurrentValue - totalPurchase) / totalPurchase) * 100)
      : 0;

  return (
    <div className="flex-1 overflow-y-auto pb-24 pt-4">
      <div className="px-4 max-w-lg mx-auto w-full space-y-5">
        {/* Header — Kho trên, nhãn phụ dưới, căn giữa */}
        <div className="flex flex-col items-center text-center pt-1">
          <h1 className="text-4xl font-bold text-white">Kho</h1>
          <p className="text-xs text-[#5A5F72] uppercase tracking-widest font-medium mt-2">
            Quản lý tài sản
          </p>
        </div>

        {loadError && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "#FCD34D",
            }}
          >
            {loadError}
          </div>
        )}

        {/* Add product form */}
        <div
          className="rounded-3xl p-5 space-y-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1 h-4 rounded-full"
              style={{ background: "#7B61FF" }}
            />
            <h2 className="text-white font-semibold text-sm">
              Thêm sản phẩm
            </h2>
          </div>

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs text-[#5A5F72] uppercase tracking-wide mb-1.5">
                Tên sản phẩm
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên..."
                className="w-full rounded-xl px-4 py-3 text-white placeholder-[#3A3F52] text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(123,97,255,0.4)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.06)";
                }}
              />
            </div>

            <div>
              <label className="block text-xs text-[#5A5F72] uppercase tracking-wide mb-1.5">
                Mã JAN (8-14 chữ số)
              </label>
              <div className="relative">
                <input
                  value={jan}
                  onChange={(e) => setJan(e.target.value)}
                  placeholder="4549636..."
                  inputMode="numeric"
                  className="w-full rounded-xl px-4 py-3 pr-10 text-white placeholder-[#3A3F52] text-sm font-mono outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(123,97,255,0.4)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.06)";
                  }}
                />
                <ScanLine
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3F52]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#5A5F72] uppercase tracking-wide mb-1.5">
                Giá mua (¥)
              </label>
              <div className="relative">
                <input
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full rounded-xl px-4 py-3 pr-8 text-white placeholder-[#3A3F52] text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(123,97,255,0.4)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.06)";
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3F52] text-sm font-bold">
                  ¥
                </span>
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-xs">{formError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "#7B61FF",
                boxShadow: "0 0 16px rgba(123,97,255,0.3)",
              }}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              <span>{saving ? "Đang lưu…" : "Thêm & lưu vào kho"}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCheckProfit()}
              disabled={profitLoading || items.length === 0}
              className="w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {profitLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <BarChart2 size={17} />
              )}
              <span>{profitLoading ? "Đang quét giá…" : "Check kho"}</span>
            </button>
          </form>
        </div>

        {/* Total value card */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[#5A5F72] uppercase tracking-wide">
              Giá trị hiện tại
            </p>
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{
                background: "rgba(0,208,132,0.12)",
                color: "#00D084",
              }}
            >
              {profitPercent >= 0 ? "+" : ""}
              {profitPercent}% / tổng
            </span>
          </div>
          <p className="text-3xl font-bold text-white mt-1 mb-4">
            {formatYen(totalCurrentValue)}
          </p>
          <button
            onClick={() => void handleCheckProfit()}
            disabled={profitLoading || items.length === 0}
            className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: "#00D084",
              boxShadow: "0 0 16px rgba(0,208,132,0.3)",
              color: "#0B0E14",
            }}
          >
            {profitLoading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
            ) : (
              <Zap size={18} />
            )}
            <span>{profitLoading ? "Đang quét…" : "Check giá nhanh"}</span>
          </button>
        </div>

        {/* Items list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={13} className="text-[#8B8FA8]" />
              <span className="text-xs font-semibold tracking-widest text-[#8B8FA8] uppercase">
                Danh sách ({items.length})
              </span>
            </div>
            {profitMeta && (
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{
                  background: "rgba(0,208,132,0.1)",
                  color: "#00D084",
                }}
              >
                Updated
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div
              className="rounded-2xl py-10 text-center"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "2px dashed rgba(255,255,255,0.06)",
              }}
            >
              <Package size={32} className="text-[#3A3F52] mx-auto mb-3" />
              <p className="text-[#5A5F72] text-sm">
                Quét thêm sản phẩm để theo dõi lợi nhuận
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((row) => {
                const profitRow = profitRows?.find((r) => r.jan === row.jan);
                const currentPrice = profitRow?.max_kaitori_price ?? null;
                const profit = profitRow?.profit ?? null;
                const siteName = profitRow?.max_price_site ?? null;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl p-4 flex items-center gap-3 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(123,97,255,0.1)" }}
                    >
                      <Tag size={18} className="text-[#7B61FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {row.name || "—"}
                      </p>
                      <p className="text-[#5A5F72] text-xs font-mono">
                        JAN: {row.jan}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[#8B8FA8] text-xs">
                          Mua: {formatYen(row.purchase_price)}
                        </span>
                        {siteName && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: "rgba(123,97,255,0.1)",
                              color: "#A78BFA",
                            }}
                          >
                            {siteName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {currentPrice != null && (
                        <p className="text-white text-sm font-bold">
                          {formatYen(currentPrice)}
                        </p>
                      )}
                      {profit != null && (
                        <p
                          className={`text-xs font-bold ${
                            profit > 0
                              ? "text-[#00D084]"
                              : profit < 0
                              ? "text-red-400"
                              : "text-[#8B8FA8]"
                          }`}
                        >
                          {profit > 0 ? "+" : ""}
                          {formatYen(profit)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleRemove(row.id)}
                        disabled={saving}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5A5F72] hover:text-red-400 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {profitError && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-2 text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#FCA5A5",
            }}
          >
            <AlertCircle size={15} />
            {profitError}
          </div>
        )}

        {/* Profit details table */}
        {profitRows && profitRows.length > 0 && showProfitDetails && (
          <div
            className="rounded-3xl p-5 space-y-3"
            style={{
              background: "rgba(0,208,132,0.04)",
              border: "1px solid rgba(0,208,132,0.15)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 size={14} className="text-[#00D084]" />
                <h3 className="text-white text-sm font-semibold">
                  Chi tiết kaitori
                </h3>
              </div>
              {profitMeta && (
                <span className="text-[#5A5F72] text-xs">
                  {new Date(profitMeta).toLocaleString("vi-VN")}
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {profitRows.map((r, idx) => (
                <div
                  key={`${r.jan}-${idx}`}
                  className="rounded-xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-sm font-medium truncate max-w-[180px]">
                      {r.name ?? r.jan}
                    </p>
                    {r.profit != null && (
                      <span
                        className={`text-sm font-bold ${
                          r.profit > 0
                            ? "text-[#00D084]"
                            : r.profit < 0
                            ? "text-red-400"
                            : "text-[#8B8FA8]"
                        }`}
                      >
                        {r.profit > 0 ? "+" : ""}
                        {formatYen(r.profit)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#5A5F72]">
                    <span>Mua: {formatYen(r.purchase_price ?? undefined)}</span>
                    <span>→</span>
                    <span>Kaitori: {formatYen(r.max_kaitori_price ?? undefined)}</span>
                    {r.max_price_site && (
                      <span
                        className="px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: "rgba(123,97,255,0.1)",
                          color: "#A78BFA",
                        }}
                      >
                        {r.max_price_site}
                      </span>
                    )}
                  </div>
                  {r.link && (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs"
                      style={{ color: "#7B61FF" }}
                    >
                      Xem chi tiết
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {r.error && (
                    <p className="text-red-400 text-xs mt-1">{r.error}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowProfitDetails(false)}
              className="w-full text-center text-xs text-[#5A5F72] py-1 hover:text-white transition-colors"
            >
              Thu gọn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("check");

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
  }[] = [
    {
      id: "check",
      label: "CHECK GIÁ",
      icon: <Wallet size={20} strokeWidth={2} />,
      activeIcon: <Wallet size={20} strokeWidth={2} />,
    },
    {
      id: "tcg",
      label: "CHECK TCG",
      icon: <ScanLine size={20} strokeWidth={2} />,
      activeIcon: <ScanLine size={20} strokeWidth={2} />,
    },
    {
      id: "vault",
      label: "KHO",
      icon: <Package size={20} />,
      activeIcon: <Package size={20} />,
    },
  ];

  return (
    <div
      className="flex flex-col h-screen max-w-lg mx-auto relative"
      style={{ backgroundColor: "#0B0E14" }}
    >
      {/* Top Header — minimal centered brand (icon + wordmark), #0B0E14 */}
      <header
        className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 px-4 flex-shrink-0"
        style={{
          paddingTop: "calc(0.875rem + env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          backgroundColor: "#0B0E14",
        }}
      >
        <div aria-hidden className="w-9" />
        <div
          className="kachi-header-brand kachi-brand-neon flex items-center justify-center min-w-0"
          aria-label="KACHI TCG"
        >
          <KachiBrandLogo />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#5A5F72] hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
            aria-label="Profile"
          >
            <User size={18} />
          </button>
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === "check" && (
        <MarketCheckTab />
      )}
      {activeTab === "tcg" && <TcgScannerTab />}
      {activeTab === "vault" && <VaultTab />}

      {/* Bottom Navigation */}
      <nav
        className="flex-shrink-0 flex items-center px-4 gap-1"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          paddingTop: "0.625rem",
          background: "rgba(13,16,22,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all active:scale-95 min-w-0"
              style={{
                background: isActive
                  ? "rgba(123,97,255,0.12)"
                  : "transparent",
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  color: isActive ? "#7B61FF" : "#5A5F72",
                }}
              >
                {isActive ? tab.activeIcon : tab.icon}
              </span>
              <span
                className="text-[10px] font-bold tracking-wide text-center leading-tight w-full block"
                style={{
                  color: isActive ? "#7B61FF" : "#5A5F72",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
