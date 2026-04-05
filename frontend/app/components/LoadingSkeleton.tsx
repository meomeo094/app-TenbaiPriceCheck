const SITE_COUNT = 4;

export default function LoadingSkeleton() {
  return (
    <div className="space-y-3 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-indigo-300 text-sm font-medium animate-pulse">
          Đang tìm kiếm giá tại {SITE_COUNT} hệ thống...
        </p>
      </div>

      {Array.from({ length: SITE_COUNT }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="w-16 h-3 bg-slate-700 rounded-full" />
                <div className="w-36 h-3 bg-slate-700/70 rounded-full" />
                <div className="w-28 h-7 bg-slate-700 rounded-lg" />
              </div>
            </div>
            <div className="w-14 h-9 bg-slate-700 rounded-xl flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
