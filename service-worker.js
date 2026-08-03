// Service Worker — AMC Trasferte
// Cache statica per offline app shell (l'invio richiede connessione).

const CACHE_VERSION = 'amc-trasferte-v5';
const SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/storage.js',
    './js/here.js',
    './js/odoo.js',
    './config.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Cache-first per la app shell (stesso origine, GET)
    if (event.request.method === 'GET' && url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request))
        );
        return;
    }

    // Network-first per HERE e Odoo (no caching, sempre fresh)
    event.respondWith(fetch(event.request));
});
