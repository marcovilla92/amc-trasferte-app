// app.js — Bootstrap UI: form, autocomplete, submit, history, status, toast.

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const dateInput = $('#date');
    const departureInput = $('#departure');
    const arrivalInput = $('#arrival');
    const notesInput = $('#notes');
    const submitBtn = $('#submit-btn');
    const tripList = $('#trip-list');
    const connStatus = $('#connection-status');
    const toggleHistoryBtn = $('#toggle-history');
    const historySection = $('#history-section');
    const form = $('#trip-form');
    const swapBtn = $('#swap-addresses');
    const repeatBtn = $('#repeat-last');
    const toastStack = $('#toast-stack');
    const offlineBanner = $('#offline-banner');

    // ---- Init ---------------------------------------------------------------
    function init() {
        dateInput.value = new Date().toISOString().slice(0, 10);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').catch(() => {});
        }

        watchConnection((online) => {
            connStatus.textContent = online ? 'online' : 'offline';
            connStatus.className = 'status-pill ' + (online ? 'online' : 'offline');
            submitBtn.disabled = !online;
            submitBtn.title = online ? '' : 'Devi essere online per inviare la trasferta';
            offlineBanner.hidden = online;
        });

        setupAutocomplete(departureInput, $('#departure-suggestions'));
        setupAutocomplete(arrivalInput, $('#arrival-suggestions'));

        form.addEventListener('submit', onSubmit);

        swapBtn.addEventListener('click', onSwapAddresses);
        repeatBtn.addEventListener('click', onRepeatLast);

        toggleHistoryBtn.addEventListener('click', () => {
            historySection.classList.toggle('collapsed');
            const expanded = !historySection.classList.contains('collapsed');
            toggleHistoryBtn.setAttribute('aria-expanded', String(expanded));
        });

        // Clear invalid state al digitare
        [dateInput, departureInput, arrivalInput].forEach((inp) => {
            inp.addEventListener('input', () => inp.classList.remove('invalid'));
        });

        refreshHistory();
    }

    // ---- Autocomplete -------------------------------------------------------
    function setupAutocomplete(input, suggestionsEl) {
        let debounceTimer = null;
        let activeIndex = -1;
        const fieldEl = input.closest('.field');

        const render = (items) => {
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
                    input.classList.remove('invalid');
                });
                suggestionsEl.appendChild(li);
            });
        };

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const q = input.value.trim();
            if (q.length < 3) {
                suggestionsEl.innerHTML = '';
                fieldEl.classList.remove('loading');
                return;
            }
            debounceTimer = setTimeout(async () => {
                fieldEl.classList.add('loading');
                try {
                    const items = await Here.autosuggest(q);
                    render(items);
                } catch (e) {
                    console.warn('Autosuggest error', e);
                } finally {
                    fieldEl.classList.remove('loading');
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
            setTimeout(() => { suggestionsEl.innerHTML = ''; }, 200);
        });
    }

    function updateActive(items, idx) {
        items.forEach((el, i) => el.classList.toggle('active', i === idx));
    }

    // ---- Connessione --------------------------------------------------------
    function watchConnection(onChange) {
        const update = () => onChange(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        update();
    }

    // ---- Swap / Repeat ------------------------------------------------------
    function onSwapAddresses() {
        const a = departureInput.value;
        departureInput.value = arrivalInput.value;
        arrivalInput.value = a;
        departureInput.classList.remove('invalid');
        arrivalInput.classList.remove('invalid');
        haptic(30);
    }

    async function onRepeatLast() {
        const [last] = await Storage.listHistory(1);
        if (!last) {
            showToast('Nessuna trasferta precedente da ripetere.', 'info');
            return;
        }
        departureInput.value = last.departure_address || '';
        arrivalInput.value = last.arrival_address || '';
        notesInput.value = last.notes || '';
        haptic(30);
        showToast('Dati pre-compilati dall\'ultima trasferta.', 'info');
    }

    async function updateRepeatBtnState() {
        const n = await Storage.listHistory(1);
        repeatBtn.disabled = n.length === 0;
    }

    // ---- Submit -------------------------------------------------------------
    function validateForm() {
        let valid = true;
        [dateInput, departureInput, arrivalInput].forEach((inp) => {
            if (!inp.value.trim()) {
                inp.classList.add('invalid');
                valid = false;
            }
        });
        return valid;
    }

    async function onSubmit(e) {
        e.preventDefault();

        if (!navigator.onLine) {
            showToast('Sei offline. Devi avere connessione per inviare la trasferta.', 'error');
            haptic(80);
            submitBtn.disabled = true;
            return;
        }

        if (!validateForm()) {
            showToast('Compila i campi obbligatori.', 'error');
            return;
        }

        const data = {
            date: dateInput.value,
            departure_address: departureInput.value.trim(),
            arrival_address: arrivalInput.value.trim(),
            notes: notesInput.value.trim(),
        };

        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        try {
            const result = await Odoo.submitTrasferta(data);
            await Storage.addHistory({
                ...data,
                odoo_id: result.id,
                odoo_name: result.name,
                syncedAt: Date.now(),
            });
            haptic(50);
            showToast(`Inviata (#${result.id})`, 'success');
            resetForm();
            refreshHistory();
        } catch (err) {
            console.error('Submit failed:', err);
            showToast(`Invio fallito: ${err.message}. Riprova quando hai segnale stabile.`, 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = !navigator.onLine;
        }
    }

    function resetForm() {
        departureInput.value = '';
        arrivalInput.value = '';
        notesInput.value = '';
        [departureInput, arrivalInput].forEach((i) => i.classList.remove('invalid'));
        departureInput.focus();
    }

    // ---- History UI ---------------------------------------------------------
    async function refreshHistory() {
        const items = await Storage.listHistory(10);

        updateRepeatBtnState();

        if (!items.length) {
            tripList.innerHTML = `
                <div class="empty-state">
                    <svg><use href="#icon-history"/></svg>
                    <p>Nessuna trasferta inviata da questo dispositivo.<br>
                    Compila il form e premi Invia per iniziare.</p>
                </div>
            `;
            return;
        }
        const fragments = [];
        for (const h of items) {
            fragments.push(`
                <li class="trip-item synced">
                    <span class="icon"><svg><use href="#icon-check"/></svg></span>
                    <div class="info">
                        <div class="route">${escapeHtml(h.departure_address || '')} → ${escapeHtml(h.arrival_address || '')}</div>
                        <div class="date">${h.date || '—'}</div>
                    </div>
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

    // ---- Toast --------------------------------------------------------------
    const TOAST_ICONS = {
        success: 'icon-check',
        warning: 'icon-warning',
        error: 'icon-warning',
        info: 'icon-info',
    };
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconId = TOAST_ICONS[type] || 'icon-info';
        toast.innerHTML = `
            <svg><use href="#${iconId}"/></svg>
            <span>${escapeHtml(msg)}</span>
        `;
        toastStack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        const timeout = type === 'error' ? 6000 : 3500;
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 280);
        }, timeout);
    }

    // ---- Haptic -------------------------------------------------------------
    function haptic(ms) {
        if (navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (e) {}
        }
    }

    // ---- Go -----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);
})();
