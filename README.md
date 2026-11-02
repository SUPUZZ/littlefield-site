# 田野之间 · 游戏落地页（Little Field Site）

《田野之间》的**静态落地页站点**，对应线上地址：

- 中文：<https://game.supuzz.cn/>
- 英文：<https://game.supuzz.cn/en/>
- 备用域名：`https://game.supuzz.com/`（与 `.cn` 同一套内容，Nginx 分 server 块）

本仓库只负责**页面本身**：介绍页、田园图鉴、玩法长文、隐私政策、样式、图标与埋点脚本。游戏运行包、APK 下载、后台管理仍然由 `feedback-server`（`api.supuzz.cn`）提供，本仓库不包含任何后端代码。

## 技术形态

- 纯静态 HTML + CSS + 原生 JS，**没有构建步骤**，仓库根目录即发布目录。
- 页面语言：简体中文（根目录）+ 英文（`en/`）。
- 部署：`scripts/deploy.sh` 打包上传到 ECS 目录，由 Nginx 直接伺服静态文件。

## 目录结构

```
.
├── index.html                  # 中文首页（落地页主体）
├── guide.html                  # 田园图鉴（种植/动物/经营说明）
├── guide.js                    # 图鉴页交互
├── farming-game.html           # 玩法长文
├── farm-ipo.html               # 玩法长文（资本市场）
├── why-stock-trades-lose.html  # 玩法长文
├── money-basics-for-kids.html  # 玩法长文
├── privacy.html                # 隐私政策
├── en/                         # 英文版（index / guide / privacy）
├── assets/                     # 图标与游戏截图（来源见 assets/README.md）
├── site.css / comic.css / stories.css
├── site.js                     # 首页与页面交互
├── analytics.js                # 访问与转化埋点
├── robots.txt / sitemap.xml
├── ops/nginx/                  # game.supuzz.cn 的 Nginx 配置
└── scripts/deploy.sh           # 部署脚本
```

## 与后端的边界

落地页里的动态能力**全部是同域固定路径**，由 Nginx 转发给 `feedback-server`，本仓库只负责写链接，不负责实现：

| 路径 | 用途 | 由谁提供 |
| --- | --- | --- |
| `/play/` | 网页版游戏入口（当前加密发布包） | feedback-server |
| `/downloads/latest.apk` | APK 最新版下载（302 到固定版本） | feedback-server |
| `/downloads/latest.apk.sha256` | APK 校验值 | feedback-server |
| `/api/game/events` | 下载/点击/加载事件埋点 | feedback-server |
| `/api/game/support`、`/api/game/profile` 等 | 游戏内打赏、档案 | feedback-server |
| `/admin/*` | 后台（游戏发布、统计、打赏） | feedback-server，对外 404 |

`analytics.js` 是本仓库的文件，但**后端也会在 `/play/` 返回的 HTML 里注入 `</head>` 前的 `<script defer src="/analytics.js">`**。也就是说游戏页依赖本仓库把 `analytics.js` 部署在域名根路径上；改名或移动这个文件会同时影响落地页和游戏内统计。

`/play/` 也被写进了 `sitemap.xml`，由本仓库维护。

## 本地预览

静态站点起个本地服务器即可（不要用 `file://` 打开，绝对路径会失效）：

```bash
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173/
```

本地预览时 `/play/`、`/downloads/*` 会 404，这是预期的，它们属于线上后端。

## 自检

```bash
python3 scripts/check-links.py   # 站内链接 + sitemap 地址是否都指向真实文件
```

CI 在每次部署前跑同一个脚本，失败就不会上线。

## 部署

**自动**：push 到 `main` 即部署（`.github/workflows/deploy.yml`，也可在 Actions 页手动触发）。需要仓库 Secrets：

| Secret | 必填 | 说明 |
| --- | --- | --- |
| `DEPLOY_SSH_HOST` | 是 | ECS 公网 IP 或域名 |
| `DEPLOY_SSH_USER` | 是 | 一般 `root` |
| `DEPLOY_SSH_PRIVATE_KEY` | 是 | 对应公钥已写入服务器 `authorized_keys` 的私钥 |
| `DEPLOY_SSH_PORT` | 否 | 默认 22 |
| `DEPLOY_REMOTE_PATH` | 否 | 默认 `/var/www/littlefield`，必须与 Nginx `root` 一致 |

**手动**（首次上线、或 CI 不可用时）：

```bash
cp deploy.env.example .env.deploy   # 填写 ECS 地址与目录，.env.deploy 不入库
bash scripts/deploy.sh              # 上传静态文件
bash scripts/deploy.sh --reload     # 上传后顺便 nginx -t && reload
```

Nginx 配置见 `ops/nginx/`，**不随 CI 自动下发**（改配置风险高，手动改完 `nginx -t` 再 reload）。首次切换步骤见 [ops/README.md](ops/README.md)。

## 发布游戏新版本

与改页面无关：登录 <https://api.supuzz.cn/admin/login> → **游戏发布**，上传 APK / 加密游戏 ZIP。落地页的下载与 `/play/` 入口会自动指向新版本，本仓库无需改动，也无需重新部署。

页面与游戏版本是两条独立的发布链路。

## 维护约定

见 [AGENTS.md](AGENTS.md)：新增页面要中英同步、补 `sitemap.xml`、不能直接依赖后端模板变量等。
