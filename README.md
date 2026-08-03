# AMC Trasferte — PWA

App mobile per registrare le trasferte aziendali dei dipendenti AMC System.
I dati vengono inviati direttamente al modulo Odoo `fleet_trip_amc`.

## Caratteristiche

- Form mobile-first con autocomplete indirizzi via HERE
- **Richiede connessione per inviare**: se offline, banner rosso e invio bloccato (nessuna coda locale)
- App shell disponibile offline (cache service worker), l'invio no
- PWA installabile su Android (Aggiungi alla schermata Home)
- Storia delle ultime trasferte inviate da quel device (cache locale)
- Auto-conferma decisa dal server (flag nei Settings Odoo)

## Setup iniziale

### 1. Configura il modulo Odoo

Prerequisito: modulo `fleet_trip_amc` versione 1.0.8+ installato.

In Odoo: **Settings → Trasferte AMC → blocco "PWA Trasferte (app mobile dipendente)"**

- **Token PWA**: genera con `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`, incolla
- **Veicolo predefinito**: seleziona il veicolo del dipendente
- **Dipendente predefinito**: seleziona il dipendente
- **Auto-conferma** (opzionale): se attiva, le trasferte inviate dalla PWA vengono confermate subito

### 2. Configura la PWA

```bash
cp config.example.js config.js
# Modifica config.js con i valori reali:
#   - ODOO_URL (default: amc-system.odoo.com)
#   - PWA_TOKEN (stesso valore dei settings Odoo)
#   - HERE_API_KEY (la stessa del modulo Odoo)
```

⚠️ **`config.js` è committato pubblicamente** (decisione architetturale "link aperto",
vedi nota in `.gitignore`). La sicurezza si basa su:
- token PWA revocabile dai Settings Odoo
- HERE API key ristretta al dominio github.io (vedi punto 5)
- l'endpoint Odoo crea solo trasferte per il dipendente preconfigurato

### 3. Test locale

```bash
# Server HTTP semplice per testare la PWA in locale (PWA richiede HTTPS o localhost)
python3 -m http.server 8000
# → http://localhost:8000
```

### 4. Deploy su GitHub Pages

Il repo è già su GitHub (`marcovilla92/amc-trasferte-app`) con Pages attivo su main/root.
Per pubblicare una modifica basta `git push`.

URL finale: `https://marcovilla92.github.io/amc-trasferte-app/`

### 5. Restringi la HERE API key

Sul portale [developer.here.com](https://developer.here.com):
- App → la tua app → Project Settings → Restrictions
- Aggiungi `https://marcovilla92.github.io/*` come dominio autorizzato

## Architettura

```
[PWA su GitHub Pages]
  ├─ HERE Autosuggest API  (chiamata diretta browser, CORS abilitato)
  └─ POST /amc/trasferta/submit  (controller Odoo custom con cors='*')
       └─ fleet.trip.create  (draft o confermata, secondo il flag Auto-conferma)
```

## File principali

- `index.html` — form mobile
- `manifest.json` — PWA manifest (icone, theme color)
- `service-worker.js` — cache statica della app shell
- `js/storage.js` — IndexedDB (history, cache geocode)
- `js/here.js` — HERE Autosuggest wrapper
- `js/odoo.js` — POST trasferta a Odoo
- `js/app.js` — UI bootstrap + form handlers + stato connessione
- `css/style.css` — mobile-first

## Revoca accesso

Per disabilitare un'app già installata:
1. Cambia `pwa_token` in Odoo Settings
2. Aggiorna `config.js` con il nuovo token (e ri-deploy)
3. Le app vecchie con il token precedente daranno 401 al prossimo invio
