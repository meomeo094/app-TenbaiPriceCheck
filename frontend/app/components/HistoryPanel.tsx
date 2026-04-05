"use client";

import { useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);

  if (history.length === 0) return null;

  return (
    <section className="mt-6">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
      >
        <span>🕒</span>
        <span>Lịch sử ({history.length})</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible list */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-xs uppercase tracking-wider">
            Gần đây
          </span>
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
      </div>
    </section>
  );
}
