(() => {
  'use strict';

  const CFG = window.TRAM_CONFIG;
  const TZ = 'Europe/Warsaw';
  const STALE_MS = 75000;      // dane starsze niż ~3 cykle uznajemy za nieaktualne
  const FETCH_TIMEOUT = 10000;

  const fmtHM = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const fmtHMS = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const $updated = document.getElementById('updated');
  const $refresh = document.getElementById('refresh');
  const $banner = document.getElementById('banner');

  // Stan per słupek – trzymany tylko w pamięci (bez zapisywania odjazdów na dysk).
  const state = {};
  for (const s of CFG.stops) {
    const el = document.querySelector(`.board[data-stop="${s.id}"]`);
    state[s.id] = {
      el,
      list: el.querySelector('.list'),
      status: el.querySelector('.status'),
      dir: el.querySelector('.dir'),
      arrow: s.id === 2031 ? '←' : '→',
      departures: null,
      lastOk: 0,
      error: null
    };
  }

  let useProxy = false;
  let timer = null;
  let inFlight = false;
  let lastSuccessAll = 0;

  function fetchWithTimeout(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal, mode: 'cors', credentials: 'omit' })
      .finally(() => clearTimeout(t));
  }

  async function getJson(base, stopId) {
    const res = await fetchWithTimeout(base + encodeURIComponent(stopId));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.departures)) throw new Error('Nieoczekiwany format danych');
    return json;
  }

  async function loadStop(stopId) {
    if (!useProxy) {
      try {
        return await getJson(CFG.apiBase, stopId);
      } catch (e) {
        // TypeError = błąd sieci / CORS. Spróbuj proxy, jeśli skonfigurowany.
        if (!CFG.proxyBase) throw e;
        const j = await getJson(CFG.proxyBase, stopId);
        useProxy = true;
        return j;
      }
    }
    return getJson(CFG.proxyBase, stopId);
  }

  function normalize(json) {
    const out = [];
    for (const d of json.departures) {
      if (!CFG.isTram(d)) continue;
      const t = Date.parse(d.estimatedTime);
      if (!Number.isFinite(t)) continue;
      out.push({
        id: d.id,
        line: String(d.routeShortName).trim(),
        headsign: (d.headsign || '').trim() || '—',
        time: t,
        delay: typeof d.delayInSeconds === 'number' ? d.delayInSeconds : null,
        realtime: d.status === 'REALTIME'
      });
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function directionLabel(st) {
    // Nagłówek kierunku budowany z aktualnych danych (najczęstsze kierunki).
    const counts = new Map();
    for (const d of st.departures || []) counts.set(d.headsign, (counts.get(d.headsign) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
    if (top.length) st.dir.textContent = `${st.arrow} ${top.join(' / ').toUpperCase()}`;
  }

  function renderStop(st, now) {
    const stale = !st.lastOk || now - st.lastOk > STALE_MS || !!st.error;
    st.el.classList.toggle('stale', stale && !!st.departures);

    if (!st.departures) {
      st.list.innerHTML = `<li class="msg ${st.error ? 'err' : ''}">${st.error ? 'Nie udało się pobrać danych.<br><small>Spróbuj odświeżyć za chwilę.</small>' : 'Ładowanie…'}</li>`;
      st.status.textContent = '';
      return;
    }

    const rows = st.departures.filter((d) => d.time - now > -30000).slice(0, CFG.maxRows);
    if (!rows.length) {
      st.list.innerHTML = '<li class="msg">Brak tramwajów w najbliższym czasie.</li>';
    } else {
      st.list.innerHTML = rows.map((d) => {
        const diff = d.time - now;
        let eta, cls = '';
        if (diff <= 45000) { eta = 'TERAZ'; cls = 'now'; }
        else {
          const m = Math.floor(diff / 60000);
          eta = `${m}<small> min</small>`;
          if (m <= 2) cls = 'soon';
        }
        let delay = '';
        if (d.realtime && d.delay !== null && Math.abs(d.delay) >= 60) {
          const m = Math.round(d.delay / 60);
          delay = `<span class="delay ${m > 0 ? 'late' : 'early'}">${m > 0 ? '+' : '−'}${Math.abs(m)} min</span>`;
        }
        const rt = d.realtime
          ? '<span class="rt" title="Czas rzeczywisty (GPS)">● na żywo</span>'
          : '<span class="sch" title="Brak danych GPS – czas rozkładowy">rozkład</span>';
        return `<li class="row">
          <span class="line">${esc(d.line)}</span>
          <span class="dest"><span class="hs">${esc(d.headsign)}</span><span class="sub">${fmtHM.format(d.time)} ${rt} ${delay}</span></span>
          <span class="eta ${cls}">${eta}</span>
        </li>`;
      }).join('');
    }

    if (st.error) {
      st.status.innerHTML = `<span class="err">Nie udało się zaktualizować danych. Ostatnia poprawna aktualizacja: ${fmtHMS.format(st.lastOk)}. Dane mogą być nieaktualne.</span>`;
    } else if (stale) {
      st.status.innerHTML = `<span class="err">Dane mogą być nieaktualne (z ${fmtHMS.format(st.lastOk)}).</span>`;
    } else {
      st.status.textContent = '';
    }
  }

  function renderAll() {
    const now = Date.now();
    for (const id in state) renderStop(state[id], now);

    if (!navigator.onLine) {
      $banner.hidden = false;
      $banner.innerHTML = 'Brak połączenia z internetem.<br>Wyświetlane dane mogą być nieaktualne.';
    } else if (Object.values(state).every((s) => s.error)) {
      $banner.hidden = false;
      $banner.innerHTML = 'Nie udało się zaktualizować danych.' +
        (lastSuccessAll ? `<br>Ostatnia poprawna aktualizacja: ${fmtHMS.format(lastSuccessAll)}` : '');
    } else {
      $banner.hidden = true;
    }

    $updated.textContent = lastSuccessAll ? `Aktualizacja: ${fmtHMS.format(lastSuccessAll)}` : 'Brak danych';
  }

  async function refresh() {
    if (inFlight) return;
    inFlight = true;
    $refresh.disabled = true;
    $refresh.classList.add('spin');
    await Promise.all(CFG.stops.map(async (s) => {
      const st = state[s.id];
      try {
        const json = await loadStop(s.id);
        st.departures = normalize(json);
        st.lastOk = Date.now();
        st.error = null;
        directionLabel(st);
      } catch (e) {
        st.error = e;
        console.warn('Błąd pobierania', s.id, e);
      }
    }));
    const okTimes = Object.values(state).map((s) => (s.error ? 0 : s.lastOk));
    if (okTimes.some(Boolean)) lastSuccessAll = Math.max(...okTimes);
    inFlight = false;
    $refresh.disabled = false;
    $refresh.classList.remove('spin');
    renderAll();
  }

  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) refresh(); }, CFG.refreshMs);
  }

  $refresh.addEventListener('click', () => { refresh(); schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); schedule(); } });
  window.addEventListener('online', () => { refresh(); });
  window.addEventListener('offline', renderAll);
  // Odliczanie minut między zapytaniami do API.
  setInterval(() => { if (!document.hidden) renderAll(); }, 5000);

  refresh();
  schedule();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW', e));
    });
  }
})();
