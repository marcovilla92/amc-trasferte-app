// config.example.js — TEMPLATE per le config dell'app.
// Copia in config.js (NON committato) e inserisci i valori reali.

const CONFIG = {
    // URL base di Odoo (no trailing slash)
    ODOO_URL: 'https://amc-system.odoo.com',

    // Token condiviso con Odoo. Generalo in Settings → Trasferte AMC → PWA.
    PWA_TOKEN: 'INSERIRE_TOKEN_REALE_QUI',

    // HERE API key (la stessa del modulo Odoo). Restringi il referer
    // a https://<github_user>.github.io/* nel portale HERE.
    HERE_API_KEY: 'INSERIRE_HERE_API_KEY',

    // Centro di ricerca per dare priorità ai risultati Autosuggest vicini.
    // Coordinate Caprino Bergamasco (sede AMC) di default.
    SEARCH_CENTER: '45.74,9.48',

    // Codice paese ISO-3 per filtrare risultati HERE
    COUNTRY_CODE: 'ITA',
};
