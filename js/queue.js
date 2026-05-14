// queue.js — Offline queue: aggiunge trasferte fallite a IndexedDB
// e le ri-invia quando torna la connessione.
//
// Trigger di sync:
//   1. Background Sync API (Chrome Android) — il SW elabora anche con app chiusa
//   2. Fallback: eventi 'online' e 'visibilitychange' nel main thread

const Queue = (() => {

    async function enqueue(payload) {
        const item = {
            url: `${CONFIG.ODOO_URL}/amc/trasferta/submit`,
            body: payload,
            createdAt: Date.now(),
        };
        const id = await Storage.enqueue(item);
        await registerBackgroundSync();
        return id;
    }

    async function registerBackgroundSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const reg = await navigator.serviceWorker.ready;
                await reg.sync.register('trasferte-queue');
                return true;
            } catch (e) {
                console.warn('Background sync non disponibile:', e.message);
            }
        }
        return false;
    }

    async function processNow() {
        const items = await Storage.listQueue();
        if (!items.length) return {processed: 0, failed: 0};
        let processed = 0, failed = 0;
        for (const item of items) {
            try {
                const r = await fetch(item.url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: item.body,
                });
                if (r.ok) {
                    const data = await r.json().catch(() => ({}));
                    await Storage.addHistory({
                        ...JSON.parse(item.body),
                        ...data,
                        syncedAt: Date.now(),
                    });
                    await Storage.removeQueueItem(item.id);
                    processed++;
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            }
        }
        return {processed, failed};
    }

    function watchConnection(onChange) {
        const update = () => onChange(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        update();
    }

    return { enqueue, processNow, registerBackgroundSync, watchConnection };
})();
