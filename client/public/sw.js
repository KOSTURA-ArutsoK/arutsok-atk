const CACHE_NAME = "atk-v1";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ message: "Ste offline. Skontrolujte internetové pripojenie." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (
          response.ok &&
          (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico|webp)$/) ||
            url.pathname === "/")
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.destination === "document") {
          return caches.match(OFFLINE_URL);
        }
        return new Response("", { status: 503 });
      });
    })
  );
});
