"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchVapidPublicKey,
  postPushSubscription,
  urlBase64ToUint8Array,
} from "@/app/lib/api";

function serviceWorkerScriptPath(): string {
  return process.env.NODE_ENV === "production" ? "/pwa-sw.js" : "/sw.js";
}

function promiseWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} — quá ${ms / 1000}s (thường do sw.js lỗi hoặc chưa active). Thử tải lại trang.`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Đăng ký SW rồi đảm bảo có worker active.
 * Không dùng `navigator.serviceWorker.ready`: trên Safari / PWA iOS promise này đôi khi không resolve
 * dù SW đã active → gây lỗi "quá 30s". Thay vào đó chờ `registration.active` (poll + fallback).
 */
async function getOrRegisterServiceWorker(log: StepLogger): Promise<ServiceWorkerRegistration> {
  const path = serviceWorkerScriptPath();
  const waitMs = 30000;
  log(`register("${path}")…`);
  let reg = await navigator.serviceWorker.register(path, { scope: "/", updateViaCache: "none" });
  log(
    `Đã register (active=${reg.active ? "có" : "chưa"}, installing=${reg.installing ? "có" : "không"}, waiting=${reg.waiting ? "có" : "không"}).`
  );

  if (!reg.active) {
    log("Chờ reg.active (poll, không dùng navigator.serviceWorker.ready)…");
    const start = Date.now();
    while (!reg.active && Date.now() - start < waitMs) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  if (!reg.active) {
    const alt = await navigator.serviceWorker.getRegistration("/");
    if (alt?.active && alt.pushManager) {
      log("Dùng registration hiện có (getRegistration có active).");
      reg = alt;
    }
  }

  if (!reg.pushManager) {
    throw new Error("pushManager không khả dụng (thiết bị / context không hỗ trợ Web Push).");
  }
  if (!reg.active) {
    throw new Error(
      "Chưa có Service Worker active sau khi đăng ký. Thử tải lại trang hoặc gỡ PWA rồi Thêm lại Màn hình chính."
    );
  }

  log(`Service Worker active: ${reg.active.scriptURL}`);
  return reg;
}

function isIosStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

type StepLogger = (line: string) => void;

/**
 * Đăng ký Web Push: convert VAPID (base64url) → Uint8Array, rồi pushManager.subscribe.
 */
async function subscribeUser(
  registration: ServiceWorkerRegistration,
  vapidPublicKeyFromApi: string,
  log: StepLogger
): Promise<PushSubscription> {
  log("Convert key VAPID → Uint8Array…");
  const keyBytes = urlBase64ToUint8Array(vapidPublicKeyFromApi);
  log(`Đã convert (${keyBytes.byteLength} byte). pushManager.subscribe…`);
  const applicationServerKey = keyBytes as unknown as Uint8Array as BufferSource;
  return promiseWithTimeout(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }),
    45000,
    "pushManager.subscribe"
  );
}

type UiState = "idle" | "loading" | "success" | "error";

export default function PushNotificationManager({ className = "" }: { className?: string }) {
  const [state, setState] = useState<UiState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [stepLog, setStepLog] = useState<string[]>([]);
  const [standalone, setStandalone] = useState(false);

  const appendLog = useCallback((line: string) => {
    setStepLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  useEffect(() => {
    setStandalone(isIosStandalone());
  }, []);

  const enablePush = useCallback(async () => {
    setMessage(null);
    setStepLog([]);
    setState("loading");

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setState("error");
      setMessage("Trình duyệt không hỗ trợ Service Worker.");
      return;
    }

    if (!("PushManager" in window)) {
      setState("error");
      setMessage("Thiết bị không hỗ trợ Web Push.");
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandaloneNow = Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    );
    if (isIos && !isStandaloneNow) {
      setState("error");
      setMessage(
        "Trên iPhone, hãy Thêm vào Màn hình chính (Safari → Chia sẻ ↑) rồi mở app từ icon để bật thông báo đẩy."
      );
      return;
    }

    try {
      appendLog("Bắt đầu (user gesture từ nút).");
      // requestPermission phải gọi trực tiếp trong user gesture (click) — Safari yêu cầu điều này.
      let perm: NotificationPermission;
      try {
        perm = await Notification.requestPermission();
      } catch {
        // Một số trình duyệt cũ dùng callback thay vì Promise
        perm = await new Promise<NotificationPermission>((resolve) =>
          Notification.requestPermission(resolve)
        );
      }
      if (perm !== "granted") {
        appendLog(`Quyền thông báo: ${perm}`);
        setState("error");
        setMessage(
          perm === "denied"
            ? "Bạn đã chặn thông báo. Vào Cài đặt → Safari/Chrome → Thông báo để mở lại."
            : "Bạn chưa cho phép thông báo. Vui lòng nhấn Cho phép khi được hỏi."
        );
        return;
      }
      appendLog("Quyền thông báo: granted.");

      appendLog("GET VAPID public key (API)…");
      const vapid = await fetchVapidPublicKey();
      if (!vapid.configured || !vapid.publicKey) {
        appendLog(`Lỗi VAPID: ${vapid.error ?? "—"}`);
        setState("error");
        setMessage(vapid.error || "Backend chưa cấu hình VAPID. Kiểm tra .env máy chủ.");
        return;
      }
      appendLog("Đã nhận publicKey từ API.");

      appendLog("Đăng ký / chờ Service Worker (có giới hạn thời gian)…");
      const reg = await getOrRegisterServiceWorker(appendLog);
      appendLog(`SW active: ${reg.active?.scriptURL ?? "—"}`);

      const sub = await subscribeUser(reg, vapid.publicKey, appendLog);
      appendLog("Đã subscribe push (endpoint OK).");

      appendLog("POST /api/push/subscribe (header ngrok-skip-browser-warning)…");
      await postPushSubscription(sub.toJSON());
      appendLog("Đã gửi subscription lên backend.");

      setState("success");
      setMessage("✓ Đã bật thông báo và lưu subscription thành công.");
    } catch (e) {
      console.error("[PushNotificationManager]", e);
      appendLog(`Lỗi: ${e instanceof Error ? e.message : String(e)}`);
      setState("error");
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Lỗi đăng ký: ${msg}`);
    }
  }, [appendLog]);

  return (
    <section
      className={`rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 ${className}`}
    >
      <h2 className="text-slate-200 font-semibold text-base mb-1">Thông báo đẩy</h2>
      <p className="text-slate-400 text-xs leading-relaxed mb-4">
        Dùng Web Push (VAPID). Trên iPhone cần iOS 16.4+, cài PWA từ Safari (Thêm vào Màn hình chính).
        {standalone ? (
          <span className="text-emerald-400/90"> Đang chạy dạng app — phù hợp cho Push.</span>
        ) : null}
      </p>

      <button
        type="button"
        onClick={enablePush}
        disabled={state === "loading"}
        className="w-full min-h-[48px] touch-manipulation rounded-2xl bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-[15px] px-4 py-3.5 shadow-lg shadow-indigo-950/30"
      >
        {state === "loading" ? "Đang xử lý…" : "Bật thông báo iPhone"}
      </button>

      {message ? (
        <p
          className={`mt-3 text-sm leading-snug ${
            state === "success" ? "text-emerald-300" : state === "error" ? "text-amber-200" : "text-slate-400"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {stepLog.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 max-h-48 overflow-y-auto">
          <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mb-1.5">
            Nhật ký bước (iPhone)
          </p>
          <pre className="text-[11px] leading-relaxed text-slate-400 font-mono whitespace-pre-wrap break-all">
            {stepLog.join("\n")}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
