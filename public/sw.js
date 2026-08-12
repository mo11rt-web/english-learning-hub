// Service Worker بسيط — الهدف الأساسي إنه يحقق شرط "قابلية التثبيت" (PWA
// installability) اللي بيطلبه كروم/أندرويد عشان يفعّل نافذة التثبيت
// التلقائية (beforeinstallprompt)، مع كاش خفيف للملفات الثابتة يسرّع
// التحميلات المتكررة بدون ما يتدخل بطلبات Firebase (API/بيانات حيّة)
const CACHE_NAME = "english-hub-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // ما نلمس أي طلب لـ Firebase أو أي API خارجي — بس الملفات الثابتة من نفس الموقع
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});
