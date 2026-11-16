# 🚋 Tramwaje – Wilka-Krzyżanowskiego (Gdańsk)

Prosta PWA (HTML + CSS + vanilla JS) – elektroniczna tablica przystankowa z odjazdami tramwajów na żywo
z obu słupków przystanku **Wilka-Krzyżanowskiego**:

| Słupek | stopId |
|---|---|
| 01 (Strzyża / Oliwa / Zaspa) | 2031 |
| 02 (przeciwny kierunek) | 2030 |

Dane: Otwarte Dane Gdańsk / TRISTAR – `https://ckan2.multimediagdansk.pl/departures?stopId={stopId}`
(pola `routeShortName`, `headsign`, `estimatedTime` (ISO-8601 UTC), `delayInSeconds`, `status` = `REALTIME`/`SCHEDULED`).
Odświeżanie co 20 s (tyle API cache'uje dane), czas pokazywany w strefie Europe/Warsaw.

## Struktura
- `index.html`, `css/style.css`, `js/app.js`, `js/config.js`
- `manifest.webmanifest`, `sw.js` (cache tylko powłoki aplikacji – odjazdy zawsze z sieci)
- `icons/` – 192, 512, maskable 512, apple-touch
- `proxy/worker.js` – opcjonalny Cloudflare Worker, gdyby API zaczęło blokować CORS
  (wtedy ustaw `proxyBase` w `js/config.js`).

## Publikacja
GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.
Adres: `https://<użytkownik>.github.io/tramwaje-gdansk/`

## Instalacja na Androidzie
Chrome → otwórz adres → menu ⋮ → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**.
