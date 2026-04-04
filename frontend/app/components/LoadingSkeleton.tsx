export default function LoadingSkeleton() {
  return (
    <div className="space-y-3 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-indigo-300 text-sm font-medium animate-pulse">
          Đang kiểm tra giá từ 3 trang web...
        </p>
      </div>

      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg" />
              <div className="space-y-2">
                <div className="w-20 h-4 bg-slate-700 rounded-full" />
                <div className="w-32 h-7 bg-slate-700 rounded-lg" />
              </div>
            </div>
            <div className="w-16 h-9 bg-slate-700 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
