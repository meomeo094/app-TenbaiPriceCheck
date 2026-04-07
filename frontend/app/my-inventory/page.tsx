"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  checkProfit,
  getMyInventory,
  saveMyInventory,
  type CheckProfitRow,
  type MyInventoryRow,
} from "../lib/api";

function formatYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function profitClass(profit: number | null): string {
  if (profit == null || !Number.isFinite(profit)) return "font-bold text-slate-400";
  if (profit > 0) return "font-bold text-emerald-400";
  if (profit < 0) return "font-bold text-red-400";
  return "font-bold text-slate-300";
}

export default function MyInventoryPage() {
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

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getMyInventory();
      setItems(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được kho hàng.");
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
    const priceNum = parseInt(purchasePrice.replace(/[^0-9]/g, ""), 10);
    if (!/^\d{8,14}$/.test(janTrim)) {
      setFormError("Mã JAN cần 8–14 chữ số.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setFormError("Giá mua không hợp lệ.");
      return;
    }
    const row: MyInventoryRow = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}`,
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
    } catch (e) {
      setProfitError(e instanceof Error ? e.message : "Lỗi khi quét giá.");
    } finally {
      setProfitLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          href="/"
          className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border border-slate-700 active:bg-slate-700"
          aria-label="Về trang chủ"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight">Kho hàng</h1>
          <p className="text-slate-400 text-xs">my_inventory — giá mua & lợi nhuận kaitori</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-16 pt-5 max-w-2xl mx-auto w-full space-y-8">
        {loadError && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-amber-200 text-sm">
            {loadError}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-slate-200 text-sm font-semibold">Thêm sản phẩm</h2>
          <form onSubmit={handleAdd} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Tên</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên sản phẩm (tuỳ chọn)"
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-3 text-white text-base outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Mã JAN</label>
              <input
                value={jan}
                onChange={(e) => setJan(e.target.value)}
                placeholder="8–14 chữ số"
                inputMode="numeric"
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-3 text-white text-base outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Giá mua (¥)</label>
              <input
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="vd: 8500"
                inputMode="numeric"
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-3 text-white text-base outline-none"
              />
            </div>
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {saving ? "Đang lưu…" : "Thêm & lưu vào kho"}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-slate-200 text-sm font-semibold">Danh sách ({items.length})</h2>
            <button
              type="button"
              onClick={() => void handleCheckProfit()}
              disabled={profitLoading || items.length === 0}
              className="shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 px-4 py-2.5 text-sm font-semibold text-white touch-manipulation"
            >
              {profitLoading ? "Đang quét giá…" : "Check giá & lợi nhuận"}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center border border-dashed border-slate-700 rounded-2xl">
              Chưa có sản phẩm. Thêm JAN và giá mua ở trên.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Tên</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">JAN</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Giá mua</th>
                    <th className="px-3 py-2 font-medium w-16" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
                      <td className="px-3 py-2.5 max-w-[140px] truncate" title={row.name}>
                        {row.name || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-indigo-300 whitespace-nowrap">{row.jan}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatYen(row.purchase_price)}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => void handleRemove(row.id)}
                          disabled={saving}
                          className="text-red-400 hover:text-red-300 text-xs font-medium"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {profitError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200 text-sm">
            {profitError}
          </div>
        )}

        {profitRows && profitRows.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-slate-200 text-sm font-semibold">Kết quả kaitori</h2>
            {profitMeta && (
              <p className="text-slate-500 text-xs">Cập nhật: {new Date(profitMeta).toLocaleString("vi-VN")}</p>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300 min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Tên</th>
                    <th className="px-3 py-2 font-medium">JAN</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Giá mua</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Giá kaitori max</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Link</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Lãi / lỗ</th>
                  </tr>
                </thead>
                <tbody>
                  {profitRows.map((r, idx) => (
                    <tr key={`${r.jan}-${idx}`} className="border-b border-slate-800/80 last:border-0 align-top">
                      <td className="px-3 py-2.5 max-w-[120px] truncate" title={r.name ?? ""}>
                        {r.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-indigo-300 whitespace-nowrap">{r.jan}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatYen(r.purchase_price ?? undefined)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatYen(r.max_kaitori_price ?? undefined)}</td>
                      <td className="px-3 py-2.5 text-slate-400">{r.max_price_site ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {r.link ? (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all"
                          >
                            Mở
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${profitClass(r.profit)}`}>
                        {r.profit != null ? formatYen(r.profit) : "—"}
                        {r.error && <span className="block text-xs text-red-400 font-normal mt-0.5">{r.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
