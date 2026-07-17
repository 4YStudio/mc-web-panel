/**
 * MC Web Panel - Service Worker
 * 使用 "network first" 策略确保用户总是看到最新的商店内容
 */
const CACHE_NAME = 'mc-web-panel-market-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 只拦截同源请求
    if (url.origin !== self.location.origin) return;

    // 对 HTML、JSON、JS、CSS 请求使用 network-first 策略
    const shouldCache = /\.(html|json|js|css)(\?|$)/i.test(url.pathname) ||
                        url.pathname.endsWith('/') ||
                        url.pathname === self.location.pathname;

    if (!shouldCache) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
