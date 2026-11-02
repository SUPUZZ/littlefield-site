(() => {
  'use strict';
  // 介绍页有中英两版，这里用到的提示文案跟着 <html lang> 走，别让英文页漏出中文。
  const COPY = {
    'zh-CN': { noApk: 'APK 尚未发布', pending: '上传后开放下载', failed: '暂时无法获取发布信息，请稍后刷新' },
    en: { noApk: 'APK not released yet', pending: 'Available once uploaded', failed: 'Release info unavailable — please refresh' }
  };
  const copy = COPY[document.documentElement.lang] ?? COPY['zh-CN'];
  fetch('/release.json').then(response => {
    if (!response.ok) throw new Error('release unavailable');
    return response.json();
  }).then(release => {
    const version = document.getElementById('release-version');
    const size = document.getElementById('release-size');
    if (version) version.textContent = release.apk ? release.apk.version : copy.noApk;
    if (size) size.textContent = release.apk ? (release.apk.size / 1024 / 1024).toFixed(1) + ' MB' : copy.pending;
    document.querySelectorAll('[data-game-event]').forEach(link => {
      const available = link.dataset.gameEvent === 'apk_download' ? release.apk : release.web;
      link.setAttribute('aria-disabled', String(!available));
      if (available) { link.href = available.url; link.removeAttribute('tabindex'); }
    });
    const checksum = document.querySelector('.checksum');
    if (checksum) checksum.hidden = !release.apk;
  }).catch(() => {
    const size = document.getElementById('release-size');
    if (size) size.textContent = copy.failed;
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[aria-disabled="true"]');
    if (link) event.preventDefault();
  });
})();
