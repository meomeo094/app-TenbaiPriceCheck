/**
 * Service Worker dev (Next dev / không Workbox).
 *
 * Web Push — sự kiện `push` (hiện thông báo) và `notificationclick` (mở link sản phẩm / trong app)
 * được đăng ký trong `/web-push-handlers.js` (import bên dưới). Không xóa importScripts để giữ PWA.
 *
 * Production: `next build` sinh `pwa-sw.js` (Workbox) và cũng `importScripts("/web-push-handlers.js")`.
 */
importScripts("/web-push-handlers.js");

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
