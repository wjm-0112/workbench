const CACHE = 'pwb-v4';
const ASSETS = [
  // C 端页面
  './', './index.html', './tasks.html', './notes.html', './snippets.html', './profile.html',
  // C 端样式（设计令牌 + 主样式）
  './assets/css/tokens.css', './assets/css/style.css',
  // C 端脚本（含 GitHub 云同步）
  './assets/js/store.js', './assets/js/github-sync.js', './assets/js/common.js',
  './assets/js/tasks.js', './assets/js/notes.js', './assets/js/snippets.js',
  './assets/js/dashboard.js', './assets/js/profile.js',
  // 管理台（admin/，复用根 assets/js/store.js、github-sync.js）
  './admin/index.html', './admin/login.html',
  './admin/assets/css/admin.css',
  './admin/assets/js/common.js', './admin/assets/js/auth.js',
  './admin/assets/js/dashboard.js', './admin/assets/js/data.js',
  './admin/assets/js/config.js', './admin/assets/js/about.js',
  // 元信息
  './manifest.webmanifest', './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 跨域请求（如 GitHub API）不走 SW 缓存，直接走网络，避免把 HTML 当 JSON 返回
  if (url.origin !== self.location.origin) return;
  // network-first：优先取最新文件（修改后能立即生效），离线时回退缓存
  e.respondWith(
    fetch(e.request).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp));
      return resp;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
