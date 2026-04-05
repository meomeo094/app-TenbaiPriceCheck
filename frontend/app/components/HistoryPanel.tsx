"use client";

import { HistoryEntry } from "../hooks/useHistory";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect: (jan: string) => void;
  onClear: () => void;
}

export default function HistoryPanel({
  history,
  onSelect,
  onClear,
}: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          Lịch sử tìm kiếm
        </h2>
        <button
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10 active:bg-red-400/20"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="space-y-2">
        {history.map((entry) => (
          <button
            key={entry.jan + entry.time}
            onClick={() => onSelect(entry.jan)}
            className="w-full text-left bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-700/80 border border-slate-700/50 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {entry.name && (
                  <p className="text-slate-200 text-sm font-medium truncate leading-snug">
                    {entry.name}
                  </p>
                )}
                <p className="text-indigo-400 text-xs font-mono mt-0.5">
                  {entry.jan}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                {entry.highestPrice != null ? (
                  <p className="text-emerald-400 text-sm font-bold">
                    ¥{entry.highestPrice.toLocaleString("ja-JP")}
                  </p>
                ) : (
                  <p className="text-slate-500 text-xs">—</p>
                )}
                <p className="text-slate-500 text-xs mt-0.5">{entry.time}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
