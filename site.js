(() => {
  'use strict';
  // 介绍页有中英两版，这里用到的提示文案跟着 <html lang> 走，别让英文页漏出中文。
  const COPY = {
    'zh-CN': { noApk: 'APK 尚未发布', pending: '上传后开放下载', failed: '暂时无法获取发布信息，请稍后刷新' },
    en: { noApk: 'APK not released yet', pending: 'Available once uploaded', failed: 'Release info unavailable — please refresh' }
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

  const applyRelease = release => {
    const version = document.getElementById('release-version');
    const size = document.getElementById('release-size');
    if (version) version.textContent = release.apk ? release.apk.version : copy.noApk;
    if (size) size.textContent = release.apk ? (release.apk.size / 1024 / 1024).toFixed(1) + ' MB' : copy.pending;
    document.querySelectorAll('[data-game-event]').forEach(link => {
      const available = link.dataset.gameEvent === 'apk_download' ? release.apk : release.web;
      link.setAttribute('aria-disabled', String(!available));
      if (available) {
        const url = absolute(available.url);
        link.href = link.dataset.gameEvent === 'web_launch' ? withLang(url) : url;
        link.removeAttribute('tabindex');
      }
    });
    const checksum = document.querySelector('.checksum');
    if (checksum) checksum.hidden = !release.apk;
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
