// AnyProxy popup — vanilla JS.
//
// Region list is fetched from https://anyproxy.site/regions.json on open. Live
// ping is measured client-side via no-cors fetch + performance.now(). Both are
// cached in chrome.storage.local for ~10 min so re-opens are instant. If the
// fetch fails, a bundled fallback list ships with the extension.

'use strict';

const PROXY_ORIGIN = 'https://anyproxy.site';
const REGIONS_URL = 'https://anyproxy.site/regions.json';
const REGIONS_CACHE_MS = 10 * 60 * 1000;
const PING_TIMEOUT_MS = 3000;

// Bundled fallback. Shape matches worker/regions.js. Slugs match
// ap-proxy-core/app/static/bar.js REGION_LABELS + REGION_SWITCHABLE.
const FALLBACK_REGIONS = [
  { code: 'sg', city: 'Singapore', country: 'SG', tier: 'free', pingUrl: 'https://sg.anyproxy.site/ping', baselineMs: 41  },
  { code: 'fr', city: 'Frankfurt', country: 'DE', tier: 'free', pingUrl: 'https://fr.anyproxy.site/ping', baselineMs: 42  },
  { code: 'us', city: 'Virginia',  country: 'US', tier: 'free', pingUrl: 'https://us.anyproxy.site/ping', baselineMs: 118 },
  { code: 'uk', city: 'London',    country: 'GB', tier: 'pro',  pingUrl: 'https://uk.anyproxy.site/ping', baselineMs: 54  },
  { code: 'jp', city: 'Tokyo',     country: 'JP', tier: 'pro',  pingUrl: 'https://jp.anyproxy.site/ping', baselineMs: 142 },
  { code: 'br', city: 'São Paulo', country: 'BR', tier: 'pro',  pingUrl: 'https://br.anyproxy.site/ping', baselineMs: 196 },
];

const POPULAR = [
  { glyph: 'Y',  name: 'YouTube',   host: 'youtube.com' },
  { glyph: 'R',  name: 'Reddit',    host: 'reddit.com' },
  { glyph: 'X',  name: 'X',         host: 'x.com' },
  { glyph: 'Wk', name: 'Wikipedia', host: 'wikipedia.org' },
  { glyph: 'F',  name: 'Facebook',  host: 'facebook.com' },
  { glyph: 'I',  name: 'Instagram', host: 'instagram.com' },
];

const DEFAULTS = {
  autoFastest: true,
  region: null,      // resolved after regions load
  encryptDns: true,
  newTab: true,
  recents: [],
  regionsCache: null, // { fetchedAt, regions: [{...,liveMs}] }
};

// ---------- storage ----------

const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;

function loadState() {
  return new Promise(resolve => {
    if (!store) { resolve({ ...DEFAULTS }); return; }
    store.get(Object.keys(DEFAULTS), got => resolve({ ...DEFAULTS, ...got }));
  });
}
function saveState(patch) { if (store) store.set(patch); }

// ---------- helpers ----------

function fastestFreeCode(regions) {
  let best = null;
  regions.forEach(r => {
    if (r.tier === 'free' && (!best || effectiveMs(r) < effectiveMs(best))) best = r;
  });
  return best ? best.code : regions[0].code;
}
function regionByCode(regions, code) { return regions.find(r => r.code === code) || regions[0]; }
function effectiveMs(r) { return (r && (r.liveMs != null ? r.liveMs : r.baselineMs)) || 0; }
function msClass(ms) { return ms <= 90 ? 'ok' : (ms <= 170 ? 'warn' : 'err'); }
function validUrl(v) { return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test((v || '').trim()); }
function normalizeUrl(v) { const t = (v || '').trim(); return /^https?:\/\//i.test(t) ? t : 'https://' + t; }
function hostFrom(url) { try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ''); } catch { return url; } }
function glyphFor(host) {
  const bare = host.replace(/^www\./, '').split('.')[0] || '';
  const map = { youtube: 'Y', reddit: 'R', wikipedia: 'Wk', facebook: 'F', instagram: 'I', twitter: 'X', x: 'X', github: 'G' };
  return map[bare.toLowerCase()] || (bare[0] || '?').toUpperCase();
}
function siteBrand(host) {
  const bare = (host || '').replace(/^www\./, '').split('.')[0];
  if (!bare) return '';
  const known = { youtube: 'YouTube', github: 'GitHub', tiktok: 'TikTok', chatgpt: 'ChatGPT', whatsapp: 'WhatsApp' };
  const lc = bare.toLowerCase();
  if (known[lc]) return known[lc];
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

// ---------- regions + ping ----------

async function fetchRegions() {
  try {
    const res = await fetch(REGIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (!Array.isArray(j.regions) || j.regions.length === 0) throw new Error('bad shape');
    return j.regions;
  } catch (e) {
    console.warn('[anyproxy] regions.json fetch failed, using bundled fallback:', e);
    return FALLBACK_REGIONS;
  }
}

// Ping strategy mirrors ap-proxy-core/app/static/bar.js: fire 3 sequential
// samples, keep the minimum. mode:'cors' works because /ping returns
// Access-Control-Allow-Origin:* (see ap-proxy-core ping.controller.js).
// The min filter removes noisy first-request TCP/TLS handshake time.
function pingOne(region) {
  return new Promise(resolve => {
    if (!region.pingUrl) { resolve(null); return; }
    const samples = [];
    let round = 0;
    const controller = ('AbortController' in window) ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (controller) controller.abort();
      resolve(samples.length ? Math.min(...samples) : null);
    }, PING_TIMEOUT_MS);
    function tick() {
      const sep = region.pingUrl.includes('?') ? '&' : '?';
      const url = region.pingUrl + sep + 't=' + Date.now() + '.' + round;
      const start = performance.now();
      fetch(url, { mode: 'cors', cache: 'no-store', signal: controller ? controller.signal : undefined })
        .then(() => {
          samples.push(Math.round(performance.now() - start));
          round++;
          if (round < 3) return tick();
          clearTimeout(timer);
          resolve(Math.min(...samples));
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(samples.length ? Math.min(...samples) : null);
        });
    }
    tick();
  });
}

async function measurePings(regions) {
  const results = await Promise.all(regions.map(pingOne));
  return regions.map((r, i) => ({ ...r, liveMs: results[i] }));
}

// ---------- app state ----------

let S = { ...DEFAULTS };
let REGIONS = [...FALLBACK_REGIONS];
let ui = { serverOpen: false, settingsOpen: false, recentsOpen: false, loading: false, error: false, focused: false };
let activeTabHost = '';

const $ = id => document.getElementById(id);

// ---------- render ----------

function renderPopular() {
  const row = $('popularRow');
  row.innerHTML = '';
  POPULAR.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pop-tile';
    btn.title = p.name;
    btn.dataset.tip = p.name;
    btn.setAttribute('aria-label', p.name);
    btn.textContent = p.glyph;
    btn.addEventListener('click', () => {
      $('urlInput').value = p.host;
      hideError();
      renderCta();
    });
    row.appendChild(btn);
  });
}

function renderRecents() {
  const sec = $('recentsSection');
  const list = $('recentsList');
  const count = $('recentsCount');
  const chev = $('recentsChev');
  const clearCount = $('clearRecentsCount');
  const proCard = $('proCard');

  sec.hidden = S.recents.length === 0;
  // Full Pro card by default; collapse to a compact pill only while Recents
  // is expanded so both sections fit inside the 600px popup.
  if (proCard) proCard.classList.toggle('compact', S.recents.length > 0 && ui.recentsOpen);
  count.textContent = String(S.recents.length);
  clearCount.textContent = String(S.recents.length);
  chev.classList.toggle('open', ui.recentsOpen);
  $('recentsToggle').setAttribute('aria-expanded', String(ui.recentsOpen));

  list.hidden = !ui.recentsOpen;
  list.innerHTML = '';
  S.recents.forEach(r => {
    const row = document.createElement('div');
    row.className = 'recent-row';

    const g = document.createElement('span');
    g.className = 'recent-glyph';
    g.textContent = r.glyph || glyphFor(r.host);
    row.appendChild(g);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'recent-host';
    open.textContent = r.host;
    open.addEventListener('click', () => openProxy(r.host));
    row.appendChild(open);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'recent-remove';
    rm.setAttribute('aria-label', 'Remove');
    rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    rm.addEventListener('click', () => removeRecent(r.host));
    row.appendChild(rm);

    list.appendChild(row);
  });
}

function currentRegionCode() {
  if (S.autoFastest) return fastestFreeCode(REGIONS);
  if (S.region && regionByCode(REGIONS, S.region).code === S.region) return S.region;
  return fastestFreeCode(REGIONS);
}

function renderServerPill() {
  const r = regionByCode(REGIONS, currentRegionCode());
  const ms = effectiveMs(r);
  const cls = msClass(ms);
  $('serverCity').textContent = r.city;
  const msEl = $('serverMs');
  msEl.textContent = (ms || '—') + ' ms';
  msEl.className = 'ms ' + cls;
  const dot = $('serverDot');
  dot.className = 'dot ' + cls;
  $('serverChev').classList.toggle('open', ui.serverOpen);
  $('serverBtn').classList.toggle('open', ui.serverOpen);
}

function renderServerPanel() {
  $('serverScrim').hidden = !ui.serverOpen;
  $('serverPanel').hidden = !ui.serverOpen;
  const list = $('serverList');
  list.innerHTML = '';
  const selectedCode = currentRegionCode();

  REGIONS.forEach(r => {
    const locked = r.tier !== 'free';
    const selected = !locked && r.code === selectedCode;
    const ms = effectiveMs(r);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'server-row' + (selected ? ' selected' : '');
    btn.disabled = locked;
    btn.innerHTML = `
      <span class="code">${r.code}</span>
      <span class="name">${r.city}</span>
      ${locked
        ? '<span class="pro-tag">PRO</span>'
        : `<span class="ms ${msClass(ms)}">${ms || '—'} ms</span>`}
      ${selected ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--apricot)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
    `;
    if (!locked) btn.addEventListener('click', () => pickRegion(r.code));
    list.appendChild(btn);
  });
}

function renderSwitches() {
  $('rowAuto').querySelector('.switch').classList.toggle('on', !!S.autoFastest);
  $('rowDns').querySelector('.switch').classList.toggle('on', !!S.encryptDns);
  $('rowNewTab').querySelector('.switch').classList.toggle('on', !!S.newTab);
}

function renderSettings() {
  $('settingsScreen').hidden = !ui.settingsOpen;
  if (ui.settingsOpen) renderSwitches();
}

function ctaTarget() {
  const raw = ($('urlInput').value || '').trim();
  if (validUrl(raw)) return siteBrand(hostFrom(raw));
  if (activeTabHost) return siteBrand(activeTabHost);
  return '';
}

function renderCta() {
  const btn = $('submitBtn');
  const label = $('ctaLabel');
  const spin = $('ctaSpinner');
  const lock = $('ctaLock');
  btn.disabled = ui.loading;
  spin.hidden = !ui.loading;
  lock.style.display = ui.loading ? 'none' : '';
  if (ui.loading) {
    label.textContent = 'Connecting…';
    return;
  }
  const brand = ctaTarget();
  label.textContent = brand ? `Browse ${brand} Anonymously` : 'Browse Anonymously';
}

function renderUrlShell() {
  const shell = $('urlShell');
  shell.classList.toggle('focused', ui.focused && !ui.error);
  shell.classList.toggle('error', ui.error);
}

function renderAll() {
  renderPopular();
  renderRecents();
  renderServerPill();
  renderServerPanel();
  renderSettings();
  renderCta();
  renderUrlShell();
}

// ---------- actions ----------

function hideError() {
  ui.error = false;
  $('urlError').hidden = true;
  renderUrlShell();
}
function showError() {
  ui.error = true;
  $('urlError').hidden = false;
  renderUrlShell();
}

function submitUrl(e) {
  if (e) e.preventDefault();
  if (ui.loading) return;
  const raw = $('urlInput').value;
  if (!validUrl(raw)) { showError(); return; }
  hideError();
  ui.loading = true;
  renderCta();
  openProxy(raw);
  setTimeout(() => {
    ui.loading = false;
    renderCta();
    if (window.close) window.close();
  }, 400);
}

// Middleware in ap-web-ui/functions/_middleware.ts expects the target as the
// PATH, not a query param — e.g. https://anyproxy.site/youtube.com — matching
// the pattern bar.js uses when opening a new site. Region preference is
// ALWAYS forwarded via ?region= so what the popup pill shows == what the
// backend routes to. Without this the middleware falls back to CF-IPCountry
// and the shown region ≠ the used region (bug reported 2026-08-05).
// DNS toggle rides along as ?dns=1 so the setting has real wire effect once
// the backend adds a matching switch.
function openProxy(rawUrl) {
  const target = normalizeUrl(rawUrl);
  const host = hostFrom(target);
  addRecent(host);
  const stripped = target.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const params = new URLSearchParams();
  const code = currentRegionCode();
  if (code) params.set('region', code);
  if (S.encryptDns) params.set('dns', '1');
  const qs = params.toString();
  const proxyUrl = `${PROXY_ORIGIN}/${stripped}${qs ? '?' + qs : ''}`;

  if (chrome && chrome.tabs) {
    if (S.newTab && chrome.tabs.create) {
      chrome.tabs.create({ url: proxyUrl, active: true });
    } else if (chrome.tabs.update) {
      // No tabId → updates the current active tab. Requires activeTab OR tabs
      // permission; we have activeTab.
      chrome.tabs.update({ url: proxyUrl });
    } else {
      window.open(proxyUrl, '_self');
    }
  } else {
    window.open(proxyUrl, S.newTab ? '_blank' : '_self');
  }
}

function addRecent(host) {
  const glyph = glyphFor(host);
  const filtered = S.recents.filter(r => r.host !== host);
  S.recents = [{ host, glyph }, ...filtered].slice(0, 5);
  saveState({ recents: S.recents });
  renderRecents();
}
function removeRecent(host) {
  S.recents = S.recents.filter(r => r.host !== host);
  saveState({ recents: S.recents });
  renderRecents();
}
function clearRecents() {
  S.recents = [];
  saveState({ recents: [] });
  renderRecents();
}
function toggleRecents() { ui.recentsOpen = !ui.recentsOpen; renderRecents(); }
function toggleServer() { ui.serverOpen = !ui.serverOpen; renderServerPill(); renderServerPanel(); }
function closeServer() { ui.serverOpen = false; renderServerPill(); renderServerPanel(); }

function pickRegion(code) {
  S.region = code;
  S.autoFastest = false;
  saveState({ region: code, autoFastest: false });
  closeServer();
  renderServerPill();
}

function openSettings() { ui.settingsOpen = true; ui.serverOpen = false; renderServerPanel(); renderSettings(); }
function closeSettings() { ui.settingsOpen = false; renderSettings(); }

function toggleKey(key) {
  const next = !S[key];
  S[key] = next;
  const patch = { [key]: next };
  if (key === 'autoFastest' && next) {
    S.region = fastestFreeCode(REGIONS);
    patch.region = S.region;
  }
  saveState(patch);
  renderSwitches();
  renderServerPill();
}

// ---------- active tab prefill ----------

function loadActiveTab() {
  return new Promise(resolve => {
    if (!chrome || !chrome.tabs || !chrome.tabs.query) { resolve(''); return; }
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const t = tabs && tabs[0];
        const url = t && t.url;
        if (url && /^https?:\/\//i.test(url) && !url.startsWith(PROXY_ORIGIN)) {
          resolve(hostFrom(url));
        } else {
          resolve('');
        }
      });
    } catch { resolve(''); }
  });
}

// ---------- init ----------

async function init() {
  S = await loadState();

  // Wire up static handlers before any async work so the popup is responsive
  // immediately on open.
  $('urlForm').addEventListener('submit', submitUrl);
  $('urlInput').addEventListener('input', () => { if (ui.error) hideError(); renderCta(); });
  $('urlInput').addEventListener('focus', () => { ui.focused = true; renderUrlShell(); });
  $('urlInput').addEventListener('blur',  () => { ui.focused = false; renderUrlShell(); });
  $('recentsToggle').addEventListener('click', toggleRecents);
  $('serverBtn').addEventListener('click', toggleServer);
  $('serverScrim').addEventListener('click', closeServer);
  $('settingsBtn').addEventListener('click', openSettings);
  $('settingsBack').addEventListener('click', closeSettings);
  $('clearRecentsBtn').addEventListener('click', clearRecents);
  document.querySelectorAll('.settings-row.tappable').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.querySelector('.switch').dataset.key;
      toggleKey(key);
    });
  });

  // Seed regions from cache (or fallback) — instant paint.
  const cache = S.regionsCache;
  const cacheFresh = cache && (Date.now() - cache.fetchedAt) < REGIONS_CACHE_MS;
  REGIONS = (cache && Array.isArray(cache.regions) && cache.regions.length) ? cache.regions : [...FALLBACK_REGIONS];
  if (!S.region) S.region = fastestFreeCode(REGIONS);

  // Get active tab host in parallel; prefill input + refresh CTA when it
  // arrives. Excludes chrome://newtab, about:blank, and the proxy origin
  // itself (loadActiveTab filters non-http(s) URLs and the proxy origin), so
  // fresh tabs stay empty.
  loadActiveTab().then(host => {
    activeTabHost = host;
    const input = $('urlInput');
    if (host && !input.value) {
      input.value = host;
    }
    renderCta();
  });

  renderAll();

  // Background: fetch fresh region list + measure live pings, then re-render.
  if (!cacheFresh) {
    fetchRegions()
      .then(fresh => measurePings(fresh))
      .then(withPings => {
        REGIONS = withPings;
        saveState({ regionsCache: { fetchedAt: Date.now(), regions: withPings } });
        // Recompute auto pick with new numbers.
        if (S.autoFastest) S.region = fastestFreeCode(REGIONS);
        renderServerPill();
        renderServerPanel();
      })
      .catch(err => console.warn('[anyproxy] region refresh failed:', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
