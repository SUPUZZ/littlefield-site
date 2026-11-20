(() => {
  'use strict';
  // 介绍页有中英两版，这里用到的提示文案跟着 <html lang> 走，别让英文页漏出中文。
  const COPY = {
    'zh-CN': {
      noApk: 'APK 尚未发布', pending: '上传后开放下载', failed: '暂时无法获取发布信息，请稍后刷新',
      communitySoon: '共享体验 · 即将开放', communityReady: '进入共享世界',
      communityPendingNote: '共享服务尚未部署，入口会在服务上线后自动开放。',
      communityReadyNote: '体验模式 · 服务器统一地图与公库 · 不是实时联机'
    },
    en: {
      noApk: 'APK not released yet', pending: 'Available once uploaded', failed: 'Release info unavailable — please refresh',
      communitySoon: 'Shared Field · Coming soon', communityReady: 'Enter the shared field',
      communityPendingNote: 'The shared server is not deployed yet; this entrance unlocks automatically when it is.',
      communityReadyNote: 'Preview mode · server-owned map and treasury · not real-time multiplayer'
    }
  };
  const copy = COPY[document.documentElement.lang] ?? COPY['zh-CN'];
  // .com 是 GitHub Pages 上的纯静态站，发布信息与下载/游玩地址都在 .cn；
  // 返回的 url 是根路径，跨域时要补全，否则点下去会 404。
  const apiOrigin = location.hostname === 'game.supuzz.cn' ? '' : 'https://game.supuzz.cn';
  const absolute = url => /^https?:\/\//.test(url) ? url : apiOrigin + url;
  // 上一次成功的发布信息留在本机：接口偶发失败（解析抖动、断网）时按钮不该变灰。
  const CACHE_KEY = 'littlefield_release';

  // 进入游戏要带上当前页面语言：release.json 给的是裸路径 /play/，
  // 直接用它会把落地页的 ?lang= 丢掉，英文系统的人又会掉进英文版。
  const pageLang = /^en/i.test(document.documentElement.lang || '') ? 'en' : 'zh-CN';
  const withLang = url => url + (url.includes('?') ? '&' : '?') + 'lang=' + pageLang;
  const communityHref = () => apiOrigin + '/shared/?community=1&lang=' + pageLang;

  let releaseInfo = null;
  let communityReady = false;

  const updateCommunityEntry = () => {
    const link = document.querySelector('[data-community]');
    if (!link) return;
    const ready = communityReady;
    const label = link.querySelector('[data-community-label]');
    if (label) label.textContent = ready ? copy.communityReady : copy.communitySoon;
    link.setAttribute('aria-disabled', String(!ready));
    if (ready) {
      link.href = communityHref();
      link.removeAttribute('tabindex');
    } else {
      link.setAttribute('tabindex', '-1');
    }
    const note = document.getElementById('community-status');
    if (note) note.textContent = ready ? copy.communityReadyNote : copy.communityPendingNote;
  };

  const applyRelease = release => {
    releaseInfo = release;
    const version = document.getElementById('release-version');
    const size = document.getElementById('release-size');
    if (version) version.textContent = release.apk ? release.apk.version : copy.noApk;
    if (size) size.textContent = release.apk ? (release.apk.size / 1024 / 1024).toFixed(1) + ' MB' : copy.pending;
    document.querySelectorAll('[data-game-event]').forEach(link => {
      const isCommunity = link.dataset.community === '1';
      const available = isCommunity ? communityReady : (link.dataset.gameEvent === 'apk_download' ? release.apk : release.web);
      link.setAttribute('aria-disabled', String(!available));
      if (available) {
        if (isCommunity) {
          link.href = communityHref();
        } else {
          const url = absolute(available.url);
          link.href = link.dataset.gameEvent === 'web_launch' ? withLang(url) : url;
        }
        link.removeAttribute('tabindex');
      }
    });
    const checksum = document.querySelector('.checksum');
    if (checksum) checksum.hidden = !release.apk;
    updateCommunityEntry();
  };

  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  };

  // 最多试 3 次；偶发的解析抖动重试一次通常就过去了。
  const fetchRelease = attempt => fetch(apiOrigin + '/release.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('release unavailable');
      return response.json();
    })
    .catch(error => {
      if (attempt >= 3) throw error;
      return new Promise(resolve => setTimeout(resolve, 700 * attempt)).then(() => fetchRelease(attempt + 1));
    });

  // 共享体验需要 game.supuzz.cn 上的 /api/community/meta；接口不存在时入口保持“即将开放”，
  // 不把用户带到一个只会打开单人农场的地址。接口上线后无需改页面即可自动开放。
  const checkCommunity = () => fetch(apiOrigin + '/api/community/meta', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => { communityReady = !!(data && data.ok); })
    .catch(() => { communityReady = false; })
    .finally(() => {
      if (releaseInfo) applyRelease(releaseInfo);
      else updateCommunityEntry();
    });

  checkCommunity();

  fetchRelease(1).then(release => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(release)); } catch {}
    applyRelease(release);
  }).catch(() => {
    const cached = readCache();
    if (cached) { applyRelease(cached); return; }
    const size = document.getElementById('release-size');
    if (size) size.textContent = copy.failed;
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[aria-disabled="true"]');
    if (link) event.preventDefault();
  });
})();
