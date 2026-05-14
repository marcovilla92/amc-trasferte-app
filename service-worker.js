// Service Worker — AMC Trasferte
// - Cache statica per offline app shell
// - Background Sync: rilancia le trasferte in coda quando torna la connessione

const CACHE_VERSION = 'amc-trasferte-v1';
const SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/storage.js',
    './js/here.js',
    './js/odoo.js',
    './js/queue.js',
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

// Background Sync — il client registra un sync evento "trasferte-queue"
// quando il submit fallisce per offline. Il SW lo elabora qui.
self.addEventListener('sync', (event) => {
    if (event.tag === 'trasferte-queue') {
        event.waitUntil(processQueue());
    }
});

async function processQueue() {
    // Apre IDB ed elabora la coda. Importa la stessa funzione di queue.js
    // (qui replicata in versione SW perché non possiamo importMD3).
    const db = await openDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const all = await getAll(store);
    for (const item of all) {
        try {
            const r = await fetch(item.url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: item.body,
            });
            if (r.ok) {
                store.delete(item.id);
                // Notifica al client (se aperto)
                const clients = await self.clients.matchAll({type: 'window'});
                for (const c of clients) {
                    c.postMessage({type: 'trip-synced', id: item.id});
                }
            }
        } catch (e) {
            // resta in coda
        }
    }
    await tx.complete;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('amc-trasferte', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('queue')) {
                db.createObjectStore('queue', {keyPath: 'id', autoIncrement: true});
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAll(store) {
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
