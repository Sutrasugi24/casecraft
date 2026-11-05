const CACHE_NAME = "casecraft-shell-v18";
const SHELL = [
  "./", "./index.html", "./management.html", "./styles.css?v=17", "./app.js?v=10", "./management.js?v=19",
  "./generator.js", "./collection-store.js", "./persistent-store.js", "./analysis-tools.js", "./structured-import.js",
  "./export-config.js", "./run-comparison.js", "./qa-report.js", "./adapter-registry.js", "./collaboration-provider.js",
  "./automation-tools.js", "./automation-results.js", "./pairwise.js", "./change-analysis.js", "./dependency-graph.js",
  "./test-data-studio.js", "./flaky-analysis.js", "./advanced-test-design.js", "./ci-quality-gate.js", "./plugin-sdk.js",
  "./localization.js", "./pwa.js", "./manifest.webmanifest", "./casecraft-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response;
  })));
});

