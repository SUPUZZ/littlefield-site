# 田野之间：game.supuzz.cn / game.supuzz.com 共用的规则。
# 由 game.supuzz.cn.conf 在每个 443 server 块里 include（期望路径
# /etc/nginx/snippets/littlefield.inc）。这里不要写 server{}，只写 location
# 以及本域名专属的 root/index。
#
# 分工：
#   静态落地页（本仓库） -> Nginx 直接读磁盘
#   /play/ 与 /downloads/ -> feedback-server(127.0.0.1:8080)
#   /api/*                -> feedback-server(127.0.0.1:8080)

# 静态站点根目录，对应 scripts/deploy.sh 的 DEPLOY_REMOTE_PATH
root /var/www/littlefield;
index index.html;

# ------------------------------------------------------------------
# 动态：网页版游戏与 APK 下载，仍由后端提供
# ------------------------------------------------------------------
location = /play {
    return 301 /play/;
}
location /play/ {
    limit_except GET HEAD { deny all; }
    # 后端的游戏相关路由整体挂在 /game 前缀下（见 feedback-server 的
    # registerGamePublishing），这里必须带上 /game/ 才是正确路径。
    proxy_pass http://127.0.0.1:8080/game/play/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
location /downloads/ {
    limit_except GET HEAD { deny all; }
    proxy_pass http://127.0.0.1:8080/game/downloads/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
}

# ------------------------------------------------------------------
# 埋点与游戏 API
# 落地页自 2026-11 起主域是 game.supuzz.com（GitHub Pages），埋点跨域上报，
# 因此下面三个 location 必须放行 OPTIONS，否则浏览器预检会被 403 拦掉，
# 页面能用但统计全丢。OPTIONS 由 @fastify/cors 直接应答 204。
# ------------------------------------------------------------------
location = /api/pageview {
    limit_except POST OPTIONS { deny all; }
    limit_req zone=littlefield_analytics burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 16k;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location ~ ^/api/pageview/[A-Za-z0-9_-]+/duration$ {
    limit_except POST OPTIONS { deny all; }
    limit_req zone=littlefield_analytics burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 4k;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location = /api/game/events {
    limit_except POST OPTIONS { deny all; }
    limit_req zone=littlefield_analytics burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 4k;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location = /api/game/support {
    limit_except GET POST OPTIONS { deny all; }
    limit_req zone=littlefield_analytics burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 4m;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location ~ ^/api/game/(profile|leaderboard|leaderboard/sync|leaderboard/me)$ {
    limit_except GET POST PUT OPTIONS { deny all; }
    limit_req zone=littlefield_analytics burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 8k;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /api/ { return 404; }
location /admin { return 404; }
location ~ /\. { deny all; }

# ------------------------------------------------------------------
# 静态落地页（本仓库）
# ------------------------------------------------------------------
# 图标与截图：长缓存，文件名不含 hash，改图时换文件名或手动清缓存
location ~* ^/assets/.*\.(svg|jpe?g|png|webp|gif|ico)$ {
    add_header Cache-Control "public, max-age=604800" always;
    try_files $uri =404;
}
# 落地页用 /release.json 判断 APK/网页版是否已发布，据此解除按钮的禁用态。
# 它必须能从这里取到，否则按钮会一直是灰的；.com（Pages）上跨域来取，后端已带 CORS。
location = /release.json {
    limit_except GET HEAD { deny all; }
    proxy_pass http://127.0.0.1:8080/game/release.json;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# /play/ 页面的 CSP 是 script-src 'self'，统计脚本必须由 .cn 自己返回，
# 不能跟着下面那条 301 跳到 .com，否则会被 CSP 拦掉、统计静默丢失。
location = /analytics.js {
    add_header Cache-Control "public, max-age=300" always;
    try_files $uri =404;
}

location / {
    limit_except GET HEAD { deny all; }
    # .cn 只作为游戏与接口的入口，页面统一交给主域 .com（GitHub Pages）。
    # .com 自身（DNS 切换前仍指向本机）不进这个分支，避免循环跳转。
    if ($host = game.supuzz.cn) {
        return 301 https://game.supuzz.com$request_uri;
    }
    try_files $uri $uri/ =404;
}
