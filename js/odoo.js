// odoo.js — Wrapper su endpoint pubblico Odoo /amc/trasferta/submit.

const Odoo = (() => {

    async function submitTrasferta(data) {
        const body = JSON.stringify({
            token: CONFIG.PWA_TOKEN,
            date: data.date,
            departure_address: data.departure_address,
            arrival_address: data.arrival_address,
            notes: data.notes || '',
        });
        const r = await fetch(`${CONFIG.ODOO_URL}/amc/trasferta/submit`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body,
        });
        let result;
        try {
            result = await r.json();
        } catch (e) {
            throw new Error(`Risposta non valida (HTTP ${r.status})`);
        }
        if (!r.ok || !result.success) {
            const err = result?.error || `HTTP ${r.status}`;
            const detail = result?.detail || result?.fields?.join(', ') || '';
            throw new Error(detail ? `${err}: ${detail}` : err);
        }
        return result; // {success, id, name, date, departure, arrival}
    }

    return { submitTrasferta };
})();
