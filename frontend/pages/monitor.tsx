"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PushSetup from "@/components/PushSetup";
import SystemCheck from "@/components/SystemCheck";
import {
  createMonitor,
  listMonitors,
  type PriceMonitorRow,
} from "@/app/lib/api";

export default function MonitorPage() {
  const [productUrl, setProductUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [intervalMin, setIntervalMin] = useState("60");
  const [items, setItems] = useState<PriceMonitorRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    setFormError(null);
    try {
      const rows = await listMonitors();
      setItems(rows);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Không tải được danh sách.");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const url = productUrl.trim();
    const price = Number(targetPrice);
    const interval = parseInt(intervalMin, 10);

    if (!url) {
      setFormError("Nhập URL sản phẩm.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Giá mục tiêu phải là số ≥ 0.");
      return;
    }
    if (!Number.isInteger(interval) || interval < 1) {
      setFormError("Chu kỳ (phút) phải là số nguyên ≥ 1.");
      return;
    }

    setSubmitting(true);
    try {
      await createMonitor({
        product_url: url,
        target_price: price,
        interval_min: interval,
        notification_channel: "push",
      });
      setProductUrl("");
      setTargetPrice("");
      setIntervalMin("60");
      await refreshList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200 active:bg-slate-700 shrink-0 touch-manipulation"
          aria-label="Về trang chủ"
        >
          ←
        </Link>
        <div className="min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">Theo dõi giá</h1>
          <p className="text-slate-400 text-xs">URL · Giá mục tiêu · Chu kỳ (phút)</p>
        </div>
      </header>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 pt-5 space-y-5">
        <SystemCheck />
        <PushSetup />

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="product_url" className="block text-slate-300 text-sm font-medium mb-1.5">
              URL sản phẩm
            </label>
            <input
              id="product_url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://…"
              value={productUrl}
              onChange={(ev) => setProductUrl(ev.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 text-base outline-none min-h-[48px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="target_price" className="block text-slate-300 text-sm font-medium mb-1.5">
                Giá mục tiêu
              </label>
              <input
                id="target_price"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                placeholder="vd: 5000"
                value={targetPrice}
                onChange={(ev) => setTargetPrice(ev.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 text-base outline-none min-h-[48px]"
              />
            </div>
            <div>
              <label htmlFor="interval_min" className="block text-slate-300 text-sm font-medium mb-1.5">
                Mỗi (phút)
              </label>
              <input
                id="interval_min"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="60"
                value={intervalMin}
                onChange={(ev) => setIntervalMin(ev.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 text-base outline-none min-h-[48px]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] touch-manipulation rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-base"
          >
            {submitting ? "Đang lưu…" : "Thêm theo dõi"}
          </button>
        </form>

        {formError ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm">
            {formError}
          </div>
        ) : null}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-300 text-sm font-medium">Đang theo dõi</h2>
            <button
              type="button"
              onClick={() => void refreshList()}
              className="text-indigo-400 text-sm font-medium py-2 px-2 -mr-2 touch-manipulation active:text-indigo-300"
            >
              Tải lại
            </button>
          </div>

          {loadingList ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Chưa có mục nào.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((row) => (
                <li
                  key={row.id ?? row.product_url}
                  className="rounded-2xl border border-slate-700/80 bg-slate-800/40 p-4 space-y-2"
                >
                  <p className="text-slate-200 text-sm font-medium break-all leading-snug">
                    {row.product_url}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>
                      Mục tiêu:{" "}
                      <span className="text-indigo-300 font-mono">{row.target_price}</span>
                    </span>
                    <span>
                      Mỗi:{" "}
                      <span className="text-slate-200">{row.interval_min} phút</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
