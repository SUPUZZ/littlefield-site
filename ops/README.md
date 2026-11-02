# 上线切换说明

现状（2026-11 起）：

| 域名 | 托管 | 谁在管 |
| --- | --- | --- |
| `game.supuzz.com` | GitHub Pages | 仓库 Settings → Pages |
| `game.supuzz.cn` | 阿里云 ECS + Nginx | 本目录的配置 |

`.cn` 上，`/` 由 Nginx 直接读 `/var/www/littlefield`，`/play/`、`/downloads/`、`/api/` 转发给 `feedback-server`。首次从"后端伺服静态页"切到"Nginx 读磁盘"分三步，**顺序不能反**（先把文件放上去，再改 Nginx，否则首页会 404）。

> 移动端相关：`/play/` 与 `/downloads/` 的 `proxy_pass` 必须带 `/game/` 前缀（后端整个游戏插件挂在 `/game` 下）。写错会 404，且只有线上才暴露得出来。

## 1. 放静态文件

首次建议手动跑一次，确认目录和权限都对：

```bash
cp deploy.env.example .env.deploy   # 填写 ECS 地址，默认目录 /var/www/littlefield
bash scripts/deploy.sh
```

之后交给 CI：把 `DEPLOY_SSH_HOST` / `DEPLOY_SSH_USER` / `DEPLOY_SSH_PRIVATE_KEY`（以及可选的 `DEPLOY_SSH_PORT`、`DEPLOY_REMOTE_PATH`）配进仓库 Secrets，push 到 `main` 就会自动上传。

确认服务器上有：

```bash
ls -la /var/www/littlefield/index.html /var/www/littlefield/en/index.html
```

> Nginx 配置**不随 CI 下发**，第 2 步始终是手动操作。

## 关于 OPTIONS

`.com` 是 Pages 上的纯静态站，埋点跨域上报到 `.cn`，浏览器会先发 `OPTIONS` 预检。`littlefield.inc` 里三个埋点 location 的 `limit_except` 必须是 `POST OPTIONS`，否则预检 403、统计静默丢失（页面本身正常，不容易发现）。

验证方式：

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS \
  -H 'Origin: https://game.supuzz.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' \
  https://game.supuzz.cn/api/game/events
# 期望 204，不是 403
```

## 2. 换 Nginx 配置

在服务器上操作，先备份：

```bash
cp /etc/nginx/snippets/littlefield.inc /etc/nginx/snippets/littlefield.inc.bak
cp /etc/nginx/conf.d/game.supuzz.cn.conf /etc/nginx/conf.d/game.supuzz.cn.conf.bak
```

用本仓库的 `ops/nginx/` 覆盖这两个文件，然后：

```bash
nginx -t && systemctl reload nginx
```

## 3. 验证

```bash
curl -sI https://game.supuzz.cn/ | head -1                    # 200，来自静态目录
curl -s  https://game.supuzz.cn/ | grep -o '<title>[^<]*'      # 中文标题
curl -sI https://game.supuzz.cn/en/ | head -1                 # 200
curl -sI https://game.supuzz.cn/play/ | head -1               # 200，后端
curl -sI https://game.supuzz.cn/downloads/latest.apk | head -1 # 302 → 固定版本
curl -sI https://game.supuzz.cn/admin | head -1               # 404
curl -sI https://game.supuzz.com/ | head -1                   # 备用域名同样 200
```

再打开页面点一次「下载 Android APK」和「打开网页版」，到 <https://api.supuzz.cn/admin/game> 确认 PV 与 `apk_download` / `web_launch` 事件仍在增长——`analytics.js` 换了伺服方，这一步必须实测。

## 回滚

```bash
cp /etc/nginx/snippets/littlefield.inc.bak /etc/nginx/snippets/littlefield.inc
cp /etc/nginx/conf.d/game.supuzz.cn.conf.bak /etc/nginx/conf.d/game.supuzz.cn.conf
nginx -t && systemctl reload nginx
```

旧配置把 `/` 反代到后端 `/game/`，所以只要 `feedback-server` 里还没删掉 `game-site/`，回滚立即生效。

## 之后：清理后端里的旧站点

新站稳定跑过一段时间后再做，交由 `feedback-server` 仓库处理：

1. 删除 `game-site/` 目录；
2. 移除 `src/game-publishing.ts` 里 `SITE_FILES` 白名单与 `/*`、`/en` 静态路由（`/play/`、`/downloads/`、`/api/` 全部保留）；
3. 去掉 `Dockerfile` 的 `COPY game-site`、`scripts/build-package.sh` 的 `cp -r game-site`；
4. 更新 `GAME-DEPLOY.md`，说明页面改由本仓库发布。

顺序很重要：先删 Nginx 对 `/game/` 的依赖（第 2 步已完成），再删代码，否则回滚就没有退路了。
