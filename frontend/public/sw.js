/**
 * Dev / fallback: SW tối thiểu cho Web Push + import handlers.
 * Production (`next build`): @ducanh2912/next-pwa sinh `pwa-sw.js` (Workbox) và cũng import `/web-push-handlers.js`.
 */
importScripts("/web-push-handlers.js");

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
