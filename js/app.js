// app.js — Bootstrap UI: form, autocomplete, submit, history, status.

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const dateInput = $('#date');
    const departureInput = $('#departure');
    const arrivalInput = $('#arrival');
    const notesInput = $('#notes');
    const submitBtn = $('#submit-btn');
    const feedback = $('#form-feedback');
    const tripList = $('#trip-list');
    const connStatus = $('#connection-status');
    const toggleHistoryBtn = $('#toggle-history');
    const historySection = $('#history-section');
    const form = $('#trip-form');

    // ---- Init ---------------------------------------------------------------
    function init() {
        // Data oggi di default
        dateInput.value = new Date().toISOString().slice(0, 10);

        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(() => console.log('SW registrato'))
                .catch((e) => console.warn('SW registr. fallita', e));
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'trip-synced') {
                    showFeedback('Trasferta in coda inviata.', 'success');
                    refreshHistory();
                }
            });
        }

        // Status connessione
        Queue.watchConnection((online) => {
            connStatus.textContent = online ? '● online' : '◌ offline';
            connStatus.className = 'status-pill ' + (online ? 'online' : 'offline');
            if (online) {
                Queue.processNow().then((r) => {
                    if (r.processed) {
                        showFeedback(`${r.processed} trasferta/e in coda inviata/e.`, 'success');
                        refreshHistory();
                    }
                });
            }
        });

        // Anche su visibility change (utente riapre la PWA), processa la coda
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine) {
                Queue.processNow().then((r) => {
                    if (r.processed) refreshHistory();
                });
            }
        });

        // Autocomplete handlers
        setupAutocomplete(departureInput, $('#departure-suggestions'));
        setupAutocomplete(arrivalInput, $('#arrival-suggestions'));

        // Submit
        form.addEventListener('submit', onSubmit);

        // Toggle history
        toggleHistoryBtn.addEventListener('click', () => {
            historySection.classList.toggle('collapsed');
            const expanded = !historySection.classList.contains('collapsed');
            toggleHistoryBtn.setAttribute('aria-expanded', String(expanded));
        });

        refreshHistory();
    }

    // ---- Autocomplete -------------------------------------------------------
    function setupAutocomplete(input, suggestionsEl) {
        let debounceTimer = null;
        let activeIndex = -1;
        let lastItems = [];

        const render = (items) => {
            lastItems = items;
            activeIndex = -1;
            suggestionsEl.innerHTML = '';
            items.forEach((it, idx) => {
                const li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.dataset.idx = idx;
                li.textContent = it.label;
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = it.label;
                    suggestionsEl.innerHTML = '';
                    input.dataset.confirmed = '1';
                });
                suggestionsEl.appendChild(li);
            });
        };

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            input.dataset.confirmed = '';
            const q = input.value.trim();
            if (q.length < 3) {
                suggestionsEl.innerHTML = '';
                return;
            }
            debounceTimer = setTimeout(async () => {
                try {
                    const items = await Here.autosuggest(q);
                    render(items);
                } catch (e) {
                    console.warn('Autosuggest error', e);
                }
            }, 300);
        });

        input.addEventListener('keydown', (e) => {
            const items = suggestionsEl.querySelectorAll('li');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                updateActive(items, activeIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                updateActive(items, activeIndex);
            } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                items[activeIndex].dispatchEvent(new MouseEvent('mousedown'));
            } else if (e.key === 'Escape') {
                suggestionsEl.innerHTML = '';
            }
        });

        input.addEventListener('blur', () => {
            // Lascio chiudere dopo un piccolo delay per permettere click su <li>
            setTimeout(() => { suggestionsEl.innerHTML = ''; }, 200);
        });
    }

    function updateActive(items, idx) {
        items.forEach((el, i) => el.classList.toggle('active', i === idx));
    }

    // ---- Submit -------------------------------------------------------------
    async function onSubmit(e) {
        e.preventDefault();
        showFeedback('Invio in corso…', '');
        submitBtn.disabled = true;

        const data = {
            date: dateInput.value,
            departure_address: departureInput.value.trim(),
            arrival_address: arrivalInput.value.trim(),
            notes: notesInput.value.trim(),
        };

        if (!data.date || !data.departure_address || !data.arrival_address) {
            showFeedback('Compila tutti i campi obbligatori.', 'error');
            submitBtn.disabled = false;
            return;
        }

        try {
            const result = await Odoo.submitTrasferta(data);
            await Storage.addHistory({
                ...data,
                odoo_id: result.id,
                odoo_name: result.name,
                syncedAt: Date.now(),
            });
            showFeedback(`Trasferta inviata (#${result.id}).`, 'success');
            resetForm();
            refreshHistory();
        } catch (e) {
            console.error('Submit failed:', e);
            // Salva in coda offline
            try {
                const body = JSON.stringify({
                    token: CONFIG.PWA_TOKEN,
                    date: data.date,
                    departure_address: data.departure_address,
                    arrival_address: data.arrival_address,
                    notes: data.notes,
                });
                await Queue.enqueue(body);
                showFeedback('Salvata in coda — invio quando torna la connessione.', 'warn');
                resetForm();
                refreshHistory();
            } catch (err) {
                showFeedback(`Errore: ${e.message}`, 'error');
            }
        } finally {
            submitBtn.disabled = false;
        }
    }

    function resetForm() {
        departureInput.value = '';
        arrivalInput.value = '';
        notesInput.value = '';
        // Data resta su oggi
    }

    // ---- History UI ---------------------------------------------------------
    async function refreshHistory() {
        const items = await Storage.listHistory(10);
        const queue = await Storage.listQueue();
        if (!items.length && !queue.length) {
            tripList.innerHTML = '<li class="empty">Nessuna trasferta inviata da questo dispositivo.</li>';
            return;
        }
        const fragments = [];
        for (const q of queue) {
            const body = JSON.parse(q.body || '{}');
            fragments.push(`
                <li class="trip-item queued">
                    <span class="date">${body.date || '—'}</span>
                    <span class="route">${escapeHtml(body.departure_address || '')} → ${escapeHtml(body.arrival_address || '')}</span>
                    <span class="badge">in coda</span>
                </li>
            `);
        }
        for (const h of items) {
            fragments.push(`
                <li class="trip-item synced">
                    <span class="date">${h.date || '—'}</span>
                    <span class="route">${escapeHtml(h.departure_address || '')} → ${escapeHtml(h.arrival_address || '')}</span>
                    <span class="badge ok">#${h.odoo_id || '?'}</span>
                </li>
            `);
        }
        tripList.innerHTML = fragments.join('');
    }

    function escapeHtml(s) {
        return (s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[c]);
    }

    // ---- Feedback -----------------------------------------------------------
    function showFeedback(msg, type) {
        feedback.textContent = msg;
        feedback.className = 'feedback ' + (type || '');
        if (type === 'success' || type === 'warn') {
            setTimeout(() => {
                if (feedback.textContent === msg) {
                    feedback.textContent = '';
                    feedback.className = 'feedback';
                }
            }, 4500);
        }
    }

    // ---- Go -----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);
})();
