// storage.js — IndexedDB wrapper per: queue di trasferte da inviare,
// storico delle inviate, cache geocode locale.
//
// Espone l'oggetto globale `Storage` con metodi async.

const Storage = (() => {
    const DB_NAME = 'amc-trasferte';
    const DB_VERSION = 1;

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('queue')) {
                    db.createObjectStore('queue', {keyPath: 'id', autoIncrement: true});
                }
                if (!db.objectStoreNames.contains('history')) {
                    const s = db.createObjectStore('history', {keyPath: 'id', autoIncrement: true});
                    s.createIndex('date', 'date');
                }
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', {keyPath: 'query'});
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function tx(storeName, mode = 'readonly') {
        return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
    }

    function promisify(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    return {
        // -------- Queue (trasferte da inviare in offline) ----------
        async enqueue(item) {
            const store = await tx('queue', 'readwrite');
            return promisify(store.add(item));
        },
        async listQueue() {
            const store = await tx('queue');
            return promisify(store.getAll());
        },
        async removeQueueItem(id) {
            const store = await tx('queue', 'readwrite');
            return promisify(store.delete(id));
        },
        async countQueue() {
            const store = await tx('queue');
            return promisify(store.count());
        },

        // -------- History (trasferte inviate con successo) --------
        async addHistory(item) {
            const store = await tx('history', 'readwrite');
            return promisify(store.add(item));
        },
        async listHistory(limit = 10) {
            const store = await tx('history');
            const all = await promisify(store.getAll());
            // Più recenti prima (assumiamo id crescente)
            return all.sort((a, b) => b.id - a.id).slice(0, limit);
        },

        // -------- Cache geocode/autosuggest ----------
        async getCache(query) {
            const store = await tx('cache');
            return promisify(store.get(query));
        },
        async setCache(query, items) {
            const store = await tx('cache', 'readwrite');
            return promisify(store.put({query, items, ts: Date.now()}));
        },
    };
})();
