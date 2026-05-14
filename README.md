# AMC Trasferte — PWA

App mobile per registrare le trasferte aziendali dei dipendenti AMC System.
I dati vengono inviati direttamente al modulo Odoo `fleet_trip_amc`.

## Caratteristiche

- Form mobile-first con autocomplete indirizzi via HERE
- Funziona offline: salva in coda IndexedDB e ri-invia quando torna la connessione (Background Sync)
- PWA installabile su Android (Aggiungi alla schermata Home)
- Storia delle ultime trasferte inviate da quel device (cache locale)

## Setup iniziale

### 1. Configura il modulo Odoo

Prerequisito: modulo `fleet_trip_amc` versione 1.0.8+ installato.

In Odoo: **Settings → Trasferte AMC → blocco "PWA Trasferte (app mobile dipendente)"**

- **Token PWA**: genera con `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`, incolla
- **Veicolo predefinito**: seleziona il veicolo del dipendente
- **Dipendente predefinito**: seleziona il dipendente

### 2. Configura la PWA

```bash
cp config.example.js config.js
# Modifica config.js con i valori reali:
#   - ODOO_URL (default: amc-system.odoo.com)
#   - PWA_TOKEN (stesso valore dei settings Odoo)
#   - HERE_API_KEY (la stessa del modulo Odoo)
```

⚠️ `config.js` è in `.gitignore` per non committare segreti.

### 3. Test locale

```bash
# Server HTTP semplice per testare la PWA in locale (PWA richiede HTTPS o localhost)
python3 -m http.server 8000
# → http://localhost:8000
```

### 4. Deploy su GitHub Pages

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:<utente>/amc-trasferte-app.git
git push -u origin main

# Su GitHub: Settings → Pages → Source: main / root → Save
```

⚠️ Per pubblicare il `config.js` su GitHub Pages senza committarlo:
- **Opzione A**: GitHub Actions con secrets (più sicuro)
- **Opzione B**: deploy manuale - committa `config.js` accettando che è pubblico

URL finale: `https://<utente>.github.io/amc-trasferte-app/`

### 5. Restringi la HERE API key

Sul portale [developer.here.com](https://developer.here.com):
- App → la tua app → Project Settings → Restrictions
- Aggiungi `https://<utente>.github.io/*` come dominio autorizzato

## Architettura

```
[PWA su GitHub Pages]
  ├─ HERE Autosuggest API  (chiamata diretta browser, CORS abilitato)
  └─ POST /amc/trasferta/submit  (controller Odoo custom con cors='*')
       └─ fleet.trip.create(state='draft')
```

## File principali

- `index.html` — form mobile
- `manifest.json` — PWA manifest (icone, theme color)
- `service-worker.js` — cache statica + Background Sync
- `js/storage.js` — IndexedDB (queue, history, cache geocode)
- `js/here.js` — HERE Autosuggest wrapper
- `js/odoo.js` — POST trasferta a Odoo
- `js/queue.js` — offline queue + Background Sync registration
- `js/app.js` — UI bootstrap + form handlers
- `css/style.css` — mobile-first

## Revoca accesso

Per disabilitare un'app già installata:
1. Cambia `pwa_token` in Odoo Settings
2. Aggiorna `config.js` con il nuovo token (e ri-deploy)
3. Le app vecchie con il token precedente daranno 401 al prossimo invio
