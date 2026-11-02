(() => {
  'use strict';
  const endpoint = '/api';
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  let visitorId;
  try {
    visitorId = localStorage.getItem('littlefield_visitor');
    if (!validUuid(visitorId)) { visitorId = uuid(); localStorage.setItem('littlefield_visitor', visitorId); }
  } catch { visitorId = uuid(); }
  const params = new URLSearchParams(location.search);
  const trim = value => typeof value === 'string' ? value.slice(0, 120) : '';
  let attribution = {};
  try { attribution = JSON.parse(sessionStorage.getItem('littlefield_attribution') || '{}') || {}; } catch {}
  attribution = { source: trim(attribution.source), medium: trim(attribution.medium), campaign: trim(attribution.campaign) };
  let externalSource = '';
  try { const referrer = new URL(document.referrer); if (referrer.origin !== location.origin) externalSource = referrer.hostname; } catch {}
  if (params.has('utm_source') || params.has('utm_medium') || params.has('utm_campaign') || externalSource || !attribution.source) {
    attribution = { source: trim(params.get('utm_source') || externalSource), medium: trim(params.get('utm_medium')), campaign: trim(params.get('utm_campaign')) };
    try { sessionStorage.setItem('littlefield_attribution', JSON.stringify(attribution)); } catch {}
  }
  const send = (url, body) => {
    const text = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([text], { type: 'application/json' }))) return; } catch {}
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, keepalive: true }).catch(() => {});
  };
  const track = event => send(endpoint + '/game/events', { id: uuid(), visitorId, event, pagePath: location.pathname.slice(0, 160), ...attribution });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-game-event]');
    if (link && link.getAttribute('aria-disabled') !== 'true' && ['apk_download', 'web_launch'].includes(link.dataset.gameEvent)) track(link.dataset.gameEvent);
  });
  let pageViewId, visibleSince = document.hidden ? null : performance.now(), activeMs = 0;
  const flush = () => {
    if (visibleSince !== null) { activeMs += performance.now() - visibleSince; visibleSince = document.hidden ? null : performance.now(); }
    const duration = Math.min(86400, Math.floor(activeMs / 1000));
    if (pageViewId && duration > 0) send(endpoint + '/pageview/' + encodeURIComponent(pageViewId) + '/duration', { duration });
  };
  fetch(endpoint + '/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ brandName: 'littlefield', domain: 'game.supuzz.cn', pageUrl: 'https://game.supuzz.cn' + location.pathname + location.search, referrer: document.referrer, userAgent: navigator.userAgent, visitorId })
  }).then(response => response.ok ? response.json() : null).then(data => { pageViewId = data?.id; flush(); }).catch(() => {});
  document.addEventListener('visibilitychange', () => { flush(); if (!document.hidden && visibleSince === null) visibleSince = performance.now(); });
  window.addEventListener('pagehide', () => { flush(); visibleSince = null; });
  window.addEventListener('pageshow', () => { if (!document.hidden && visibleSince === null) visibleSince = performance.now(); });
  setInterval(flush, 30000);
  if (location.pathname.startsWith('/play/')) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (window.LittleField && window.LittleField.rendering.frames > 0 && document.getElementById('loading')?.classList.contains('dismissed')) { clearInterval(timer); track('game_ready'); }
      else if (++attempts >= 600) clearInterval(timer);
    }, 500);
  }
})();
