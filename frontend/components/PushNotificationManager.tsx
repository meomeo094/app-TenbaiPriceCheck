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

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  const path = serviceWorkerScriptPath();
  let reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) {
    reg = await navigator.serviceWorker.register(path, { scope: "/", updateViaCache: "none" });
  }
  await navigator.serviceWorker.ready;
  return reg;
}

function isIosStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

/**
 * Đăng ký Web Push: chuyển VAPID public key (base64url) từ API sang Uint8Array rồi gọi subscribe.
 */
async function subscribeUser(
  registration: ServiceWorkerRegistration,
  vapidPublicKeyFromApi: string
): Promise<PushSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKeyFromApi) as unknown as Uint8Array as BufferSource;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

type UiState = "idle" | "loading" | "success" | "error";

export default function PushNotificationManager({ className = "" }: { className?: string }) {
  const [state, setState] = useState<UiState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isIosStandalone());
  }, []);

  const enablePush = useCallback(async () => {
    setMessage(null);
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
        setState("error");
        setMessage(
          perm === "denied"
            ? "Bạn đã chặn thông báo. Vào Cài đặt → Safari/Chrome → Thông báo để mở lại."
            : "Bạn chưa cho phép thông báo. Vui lòng nhấn Cho phép khi được hỏi."
        );
        return;
      }

      const vapid = await fetchVapidPublicKey();
      if (!vapid.configured || !vapid.publicKey) {
        setState("error");
        setMessage(vapid.error || "Backend chưa cấu hình VAPID. Kiểm tra .env máy chủ.");
        return;
      }

      const reg = await getOrRegisterServiceWorker();
      const sub = await subscribeUser(reg, vapid.publicKey);

      await postPushSubscription(sub.toJSON());
      setState("success");
      setMessage("✓ Đã bật thông báo và lưu subscription thành công.");
    } catch (e) {
      console.error("[PushNotificationManager]", e);
      setState("error");
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Lỗi đăng ký: ${msg}`);
    }
  }, []);

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
    </section>
  );
}
