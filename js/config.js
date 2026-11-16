// Konfiguracja aplikacji. Brak sekretów – to publiczny dashboard.
window.TRAM_CONFIG = {
  // Bezpośredni, oficjalny endpoint Otwartych Danych Gdańska.
  apiBase: 'https://ckan2.multimediagdansk.pl/departures?stopId=',
  // Proxy (Cloudflare Worker z katalogu proxy/). WYMAGANY: API ZTM nie wysyła
  // nagłówków CORS (sprawdzone 16.11.2026: brak Access-Control-Allow-Origin,
  // preflight → 403 "Invalid CORS request"), więc przeglądarka blokuje bezpośredni fetch.
  // Przykład: 'https://tramwaje-proxy.TWOJ-SUBDOMAIN.workers.dev/departures?stopId='
  proxyBase: '',
  stops: [
    { id: 2031, label: '01' },
    { id: 2030, label: '02' }
  ],
  refreshMs: 20000,
  maxRows: 7,
  // Linie tramwajowe w Gdańsku mają numery 1–12 (autobusy 100+, nocne N…).
  isTram: (d) => /^\d{1,2}$/.test(String(d.routeShortName || '').trim())
};
