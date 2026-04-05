"use client";

import { useEffect, useState } from "react";
import { getTopSearches, TopSearch } from "../lib/api";

interface TrendingBadgesProps {
  onSelect: (jan: string) => void;
}

export default function TrendingBadges({ onSelect }: TrendingBadgesProps) {
  const [items, setItems] = useState<TopSearch[]>([]);

  useEffect(() => {
    getTopSearches().then(setItems).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-slate-500 text-xs font-medium mb-2 flex items-center gap-1.5">
        <span>🔥</span>
        <span>Xu hướng tìm kiếm</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.jan}
            onClick={() => onSelect(item.jan)}
            className="group flex items-center gap-1.5 bg-slate-800 hover:bg-indigo-600/30 active:bg-indigo-600/50 border border-slate-700 hover:border-indigo-500/50 rounded-full px-3 py-1.5 transition-all"
          >
            <span className="text-indigo-400 group-hover:text-indigo-300 text-xs font-mono">
              {item.jan}
            </span>
            {item.name && (
              <span className="text-slate-400 group-hover:text-slate-200 text-xs truncate max-w-[120px]">
                {item.name}
              </span>
            )}
            {item.count > 1 && (
              <span className="bg-slate-700 group-hover:bg-indigo-500/30 text-slate-400 group-hover:text-indigo-300 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
