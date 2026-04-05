import { PriceResult } from "../lib/api";

const SITE_ICONS: Record<string, string> = {
  Wiki: "🎮",
  "1-chome": "📦",
  Homura: "🔥",
  MoriMori: "🌲",
};

const SITE_COLORS: Record<string, string> = {
  Wiki: "from-violet-600/20 to-purple-600/10 border-violet-500/30",
  "1-chome": "from-blue-600/20 to-cyan-600/10 border-blue-500/30",
  Homura: "from-orange-600/20 to-amber-600/10 border-orange-500/30",
  MoriMori: "from-emerald-600/20 to-teal-600/10 border-emerald-500/30",
};

const BADGE_COLORS: Record<string, string> = {
  Wiki: "bg-violet-500/20 text-violet-300",
  "1-chome": "bg-blue-500/20 text-blue-300",
  Homura: "bg-orange-500/20 text-orange-300",
  MoriMori: "bg-emerald-500/20 text-emerald-300",
};

interface PriceCardProps {
  result: PriceResult;
  rank?: number;
}

export default function PriceCard({ result, rank }: PriceCardProps) {
  const icon = SITE_ICONS[result.site] || "🏬";
  const colorClass =
    SITE_COLORS[result.site] ||
    "from-slate-600/20 to-slate-700/10 border-slate-500/30";
  const badgeClass =
    BADGE_COLORS[result.site] || "bg-slate-500/20 text-slate-300";

  const isSuccess = result.status === "success" && result.price;
  const isNotFound = result.status === "not_found";

  return (
    <div
      className={`relative bg-gradient-to-br ${colorClass} border rounded-2xl p-4 transition-all duration-200 active:scale-95`}
    >
      {rank === 1 && isSuccess && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
          👑 Cao nhất
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="text-2xl flex-shrink-0">{icon}</div>
          <div className="min-w-0 flex-1">
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${badgeClass}`}
            >
              {result.site}
            </span>

            {result.name && (
              <p className="text-slate-300 text-xs leading-snug mb-1 line-clamp-2">
                {result.name}
              </p>
            )}

            {isSuccess ? (
              <p className="text-2xl font-bold text-white">
                ¥
                {Number(
                  result.price?.replace(/[^0-9]/g, "")
                ).toLocaleString("ja-JP")}
              </p>
            ) : isNotFound ? (
              <p className="text-slate-400 text-sm">Không tìm thấy sản phẩm</p>
            ) : (
              <p className="text-red-400 text-sm">Lỗi kết nối</p>
            )}
          </div>
        </div>

        <a
          href={result.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>Xem</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
