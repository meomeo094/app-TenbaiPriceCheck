/* Service Worker — Web Push + mở link (được import bởi public/sw.js và pwa-sw.js sau build) */
self.addEventListener("push", (event) => {
  let title = "PriceCheck";
  let body = "Có cập nhật giá hoặc thông báo mới.";
  let url = "/";

  if (event.data) {
    try {
      const json = event.data.json();
      if (json.title) title = String(json.title);
      if (json.body) body = String(json.body);
      const link =
        json.url != null
          ? String(json.url)
          : json.product_url != null
            ? String(json.product_url)
            : json.link != null
              ? String(json.link)
              : "";
      if (link) url = link;
    } catch {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: "pricecheck-push",
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/";
  const targetUrl = /^https?:\/\//i.test(raw)
    ? raw
    : new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
