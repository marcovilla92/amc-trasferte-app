// here.js — Wrapper su HERE Autosuggest API.
// Espone Here.autosuggest(query) che ritorna array di {label, position}.
// Usa cache locale (Storage) per query già viste e debounce esterno (in app.js).

const Here = (() => {
    const ENDPOINT = 'https://autosuggest.search.hereapi.com/v1/autosuggest';

    async function autosuggest(query) {
        const q = (query || '').trim();
        if (q.length < 3) return [];

        // Cache hit?
        try {
            const hit = await Storage.getCache(q.toLowerCase());
            if (hit && hit.items) return hit.items;
        } catch (e) { /* ignore */ }

        const params = new URLSearchParams({
            q,
            at: CONFIG.SEARCH_CENTER || '45.74,9.48', // Caprino Bergamasco di default
            in: `countryCode:${CONFIG.COUNTRY_CODE || 'ITA'}`,
            limit: '8',
            lang: 'it-IT',
            apiKey: CONFIG.HERE_API_KEY,
        });
        const url = `${ENDPOINT}?${params.toString()}`;

        const r = await fetch(url);
        if (!r.ok) {
            console.warn('HERE Autosuggest', r.status);
            return [];
        }
        const data = await r.json();
        const items = (data.items || [])
            .filter((it) => it.resultType !== 'chainQuery' && it.resultType !== 'categoryQuery')
            .map((it) => ({
                label: it.address?.label || it.title,
                title: it.title,
                position: it.position,
                resultType: it.resultType,
            }));

        // Cache (best-effort)
        try { await Storage.setCache(q.toLowerCase(), items); } catch (e) { /* ignore */ }

        return items;
    }

    return { autosuggest };
})();
