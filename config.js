// config.js — configurazione PWA AMC Trasferte (production)
//
// IMPORTANTE: questo file viene committato pubblicamente su GitHub.
// La sicurezza si basa su:
//   - Token revocabile in Settings Odoo → Trasferte AMC → PWA
//   - HERE API key ristretta al dominio github.io (vedi developer.here.com)
//   - Endpoint Odoo accetta solo create trasferte per il dipendente preconfigurato

const CONFIG = {
    ODOO_URL: 'https://amc-system.odoo.com',
    PWA_TOKEN: 'ti5ZPZvaP7b86x50KGfQqK1ZT4DIxOkStXvOZ8eV1kU',
    HERE_API_KEY: 'yhbd2_fHxY7MD2qpnBUbcGeCcO48q2uCEnJssfEt7Pg',
    SEARCH_CENTER: '45.74,9.48',  // Caprino Bergamasco
    COUNTRY_CODE: 'ITA',
};
