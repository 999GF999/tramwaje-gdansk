// Opcjonalny Cloudflare Worker – publiczny proxy tylko do odczytu API odjazdów ZTM Gdańsk.
// Potrzebny wyłącznie, jeśli przeglądarka blokuje bezpośrednie zapytania (CORS).
// Wdrożenie: dash.cloudflare.com → Workers → Create → wklej ten plik → Deploy,
// następnie w js/config.js ustaw proxyBase na 'https://<nazwa>.<subdomena>.workers.dev/departures?stopId='.
const ALLOWED_STOPS = new Set(['2030', '2031']);
const UPSTREAM = 'https://ckan2.multimediagdansk.pl/departures?stopId=';

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const url = new URL(request.url);
    const stopId = url.searchParams.get('stopId') || '';
    if (url.pathname !== '/departures' || !ALLOWED_STOPS.has(stopId)) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstream = await fetch(UPSTREAM + stopId, { cf: { cacheTtl: 15, cacheEverything: true } });
    const headers = new Headers(cors);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=15');
    return new Response(upstream.body, { status: upstream.status, headers });
  }
};
