/* HasiScan — passthrough worker so the app is installable. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules") ||
    url.pathname.includes("__vite") ||
    url.pathname.includes("@react-refresh")
  ) {
    return;
  }
  event.respondWith(fetch(event.request));
});
