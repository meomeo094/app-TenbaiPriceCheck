"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { checkPrice, CheckPriceResponse, PriceResult } from "./lib/api";
import PriceCard from "./components/PriceCard";
import LoadingSkeleton from "./components/LoadingSkeleton";
import HistoryPanel from "./components/HistoryPanel";
import TrendingBadges from "./components/TrendingBadges";
import { useHistory } from "./hooks/useHistory";

const JanScanner = dynamic(() => import("./components/JanScanner"), {
  ssr: false,
});

export default function Home() {
  const [janCode, setJanCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CheckPriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { history, addEntry, clearHistory } = useHistory();

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

        // Lưu lịch sử
        const successResults = data.results.filter(
          (r) => r.status === "success" && r.price
        );
        const best = successResults.sort(
          (a, b) =>
            parseInt(b.price ?? "0") - parseInt(a.price ?? "0")
        )[0];

        const firstName = data.results.find((r) => r.name)?.name ?? null;

        addEntry({
          jan: data.jan,
          name: firstName,
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

  const handleHistorySelect = (jan: string) => {
    setJanCode(jan);
    handleSearch(jan);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTrendingSelect = (jan: string) => {
    setJanCode(jan);
    handleSearch(jan);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sortedResults = results?.results
    ? [...results.results].sort((a, b) => {
        const priceA = a.price ? parseInt(a.price.replace(/[^0-9]/g, ""), 10) : -1;
        const priceB = b.price ? parseInt(b.price.replace(/[^0-9]/g, ""), 10) : -1;
        return priceB - priceA;
      })
    : [];

  const highestPrice = sortedResults.find((r) => r.status === "success" && r.price);

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          🔍
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">PriceCheck</h1>
          <p className="text-slate-400 text-xs">Kiểm tra giá thu mua tại Nhật</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-5 max-w-lg mx-auto w-full">
        {/* Search Form */}
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <label className="block text-slate-300 text-sm font-medium">
            Mã JAN / Barcode
          </label>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={janCode}
              onChange={(e) => setJanCode(e.target.value)}
              placeholder="Nhập mã JAN... (vd: 4901777359702)"
              inputMode="numeric"
              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-4 text-white placeholder-slate-500 text-base outline-none transition-all pr-10"
            />
            {janCode && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                aria-label="Xóa"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Trending badges — hiện ngay dưới input */}
          <TrendingBadges onSelect={handleTrendingSelect} />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              className="flex items-center justify-center gap-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold py-4 rounded-2xl transition-colors text-base"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              Quét mã
            </button>

            <button
              type="submit"
              disabled={!janCode.trim() || isLoading}
              className="flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-colors text-base"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
              {isLoading ? "Đang tìm..." : "Tìm giá"}
            </button>
          </div>
        </form>

        {/* Loading */}
        {isLoading && <LoadingSkeleton />}

        {/* Error */}
        {error && !isLoading && (
          <div className="mt-6 bg-red-900/30 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-red-300 font-medium text-sm">Không thể kết nối Backend</p>
              <p className="text-red-400/70 text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {results && !isLoading && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-slate-300 text-sm font-medium">
                Kết quả cho mã{" "}
                <span className="font-mono text-indigo-400 font-bold">
                  {results.jan}
                </span>
              </h2>
              {highestPrice && (
                <span className="text-xs text-slate-500">
                  {new Date(results.timestamp).toLocaleTimeString("vi-VN")}
                </span>
              )}
            </div>

            {sortedResults.map((result: PriceResult, index: number) => (
              <PriceCard key={result.site} result={result} rank={index + 1} />
            ))}

            {sortedResults.every((r) => r.status !== "success") && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-slate-400">Không tìm thấy giá cho mã JAN này</p>
                <p className="text-slate-500 text-sm mt-1">Thử kiểm tra lại mã vạch</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!results && !isLoading && !error && (
          <div className="mt-12 text-center">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-slate-400 text-base font-medium">Nhập hoặc quét mã JAN</p>
            <p className="text-slate-600 text-sm mt-2">
              So sánh giá thu mua từ 4 hệ thống: Wiki, 1-chome, Homura, MoriMori
            </p>
          </div>
        )}

        {/* History */}
        <HistoryPanel
          history={history}
          onSelect={handleHistorySelect}
          onClear={clearHistory}
        />
      </div>

      {/* Scanner Modal */}
      {isScanning && (
        <JanScanner
          onScan={handleScanSuccess}
          onClose={() => setIsScanning(false)}
        />
      )}
    </main>
  );
}
