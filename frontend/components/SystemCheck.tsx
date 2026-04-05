"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchDiagnostics,
  postDiagnosticsTestPush,
  type DiagnosticsResponse,
} from "@/app/lib/api";

function StatusRow({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean | null;
  hint?: string;
}) {
  const pending = ok === null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-700/60 last:border-0">
      <span
        className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${
          pending ? "bg-slate-500 animate-pulse" : ok ? "bg-emerald-500" : "bg-red-500"
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-slate-200 text-sm font-medium">{label}</p>
        {hint ? (
          <p className="text-slate-500 text-xs mt-0.5 leading-snug">{hint}</p>
        ) : null}
      </div>
      <span className="text-xs font-medium shrink-0 text-slate-400">
        {pending ? "…" : ok ? "OK" : "Lỗi"}
      </span>
    </div>
  );
}

export default function SystemCheck({ className = "" }: { className?: string }) {
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [diag, setDiag] = useState<DiagnosticsResponse | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [swOk, setSwOk] = useState<boolean | null>(null);

  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    if (typeof window === "undefined") return;
    setNotifOk(typeof Notification !== "undefined" && Notification.permission === "granted");

    void (async () => {
      try {
        if (!("serviceWorker" in navigator)) {
          setSwOk(false);
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration("/");
        const active = reg?.active;
        const ready =
          active?.state === "activated" &&
          Boolean(
            active.scriptURL && /sw\.js|pwa-sw\.js|workbox|swe-worker|service-worker/i.test(active.scriptURL)
          );
        setSwOk(Boolean(ready));
      } catch {
        setSwOk(false);
      }
    })();
  }, []);

  const refreshBackend = useCallback(async () => {
    setBackendReachable(null);
    setDiag(null);
    setDiagError(null);
    try {
      const data = await fetchDiagnostics();
      setDiag(data);
      setBackendReachable(true);
    } catch {
      setBackendReachable(false);
      setDiagError("Không gọi được backend / proxy.");
    }
  }, []);

  useEffect(() => {
    refreshLocal();
    void refreshBackend();
  }, [refreshLocal, refreshBackend]);

  const backendHint =
    diagError ??
    (diag
      ? `Máy chủ: Supabase ${diag.supabase.ok ? "✓" : "✗"} · VAPID ${diag.vapid.ok ? "✓" : "✗"} · Playwright ${
          diag.playwright.ok ? "✓" : "✗"
        }`
      : undefined);

  const onTestPush = async () => {
    setPushMsg(null);
    setPushLoading(true);
    try {
      const r = await postDiagnosticsTestPush();
      if (r.ok) {
        setPushMsg(r.detail || `Đã gửi: ${r.sent ?? 0}, lỗi: ${r.failed ?? 0}`);
      } else {
        setPushMsg(r.detail || "Gửi không thành công.");
      }
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : "Lỗi gọi API.");
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <section
      className={`rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 ${className}`}
    >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="text-slate-200 font-semibold text-base">Kiểm tra hệ thống</h2>
          <button
            type="button"
            onClick={() => {
              refreshLocal();
              void refreshBackend();
            }}
            className="text-indigo-400 text-sm font-medium py-1.5 px-2 touch-manipulation active:text-indigo-300"
          >
            Làm mới
          </button>
        </div>
        <p className="text-slate-500 text-xs mb-3 leading-relaxed">
          Chỉ hiển thị thành công / thất bại — không hiện khóa API.
        </p>

        <div className="rounded-xl bg-slate-900/40 px-3 py-1">
          <StatusRow
            label="Kết nối tới Backend"
            ok={backendReachable}
            hint={
              backendReachable && diag && !diag.ok
                ? "Đã tới backend; một phần kiểm tra phía server chưa đạt — xem gạch đầu dòng."
                : backendHint
            }
          />
          <StatusRow label="Quyền thông báo" ok={notifOk} hint="Notification.permission" />
          <StatusRow
            label="Service Worker"
            ok={swOk}
            hint="sw.js / pwa-sw.js đang active"
          />
        </div>

        <button
          type="button"
          disabled={pushLoading}
          onClick={onTestPush}
          className="mt-4 w-full min-h-[48px] touch-manipulation rounded-2xl border border-indigo-500/50 bg-indigo-600/20 text-indigo-200 font-semibold text-[15px] active:bg-indigo-600/30 disabled:opacity-50"
        >
          {pushLoading ? "Đang gửi…" : "Gửi thông báo Test"}
        </button>
        {pushMsg ? (
          <p className="mt-2 text-slate-400 text-xs text-center leading-snug" role="status">
            {pushMsg}
          </p>
        ) : null}
    </section>
  );
}
