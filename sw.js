// ローン比較 — オフライン用キャッシュ（ネットワーク優先）
// 更新のたびに CACHE_NAME と index.html の APP_VERSION を同じ番号に上げること
const CACHE_NAME = 'loan-sim-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
const NETWORK_TIMEOUT_MS = 3500;   // これ以上待たせず、保存済みの版を先に出す

self.addEventListener('install', function (event) {
  // ブラウザの10分キャッシュに古いファイルが残っていても拾わないよう、毎回サーバーへ取りに行く
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
          if (!res || !res.ok) throw new Error('precache failed: ' + url);
          return cache.put(url, res);
        });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// ネットワーク優先：つながれば常に最新を表示して保存する。
// つながらない・遅い（3.5秒超）ときだけ保存済みの版を使う（オフラインでも開ける）
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
    }
    return res;
  });
  net.catch(function () { /* 失敗は下で処理する。未処理警告だけ防ぐ */ });

  var timeout = new Promise(function (_, reject) { setTimeout(reject, NETWORK_TIMEOUT_MS); });

  event.respondWith(
    Promise.race([net, timeout]).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (cached) {
        return cached || net;   // 保存が無ければ、通信の結果を待つ
      });
    })
  );
});
