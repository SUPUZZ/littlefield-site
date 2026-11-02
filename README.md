# 田野之间 · 游戏落地页（Little Field Site）

《田野之间》的**静态落地页站点**。

| 域名 | 谁在伺服 | 角色 |
| --- | --- | --- |
| <https://game.supuzz.com/> | GitHub Pages（DNS `CNAME → supuzz.github.io`） | **官网**，canonical 指向这里 |
| <https://game.supuzz.cn/> | 阿里云 ECS | 页面 301 到 `.com`；只保留游戏、下载、接口（游戏真正的容器） |

两边是同一份源码，push 后自动发 Pages；`.cn` 那份只在需要更新 `/analytics.js` 时手动发（见「发布」）。

中文在根目录、英文在 `en/`。

本仓库只负责**页面本身**：介绍页、田园图鉴、玩法长文、隐私政策、样式、图标与埋点脚本。游戏运行包、APK 下载、后台管理仍然由 `feedback-server`（`api.supuzz.cn`）提供，本仓库不包含任何后端代码。

## 技术形态

- 纯静态 HTML + CSS + 原生 JS，**没有构建步骤**。
- `scripts/stage.sh` 按白名单把站点文件复制到 `dist/`，两个部署目标都上传 `dist/`。
- 发布：push 到 `main` 自动发 GitHub Pages；改 `.cn` 侧时用 `bash scripts/deploy.sh`。没有构建步骤。

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
├── ops/nginx/                  # game.supuzz.cn 的 Nginx 配置与切换说明
├── scripts/stage.sh            # 组装 dist/（白名单，两个目标共用）
├── scripts/deploy.sh           # 上传 dist/ 到 ECS
└── scripts/check-links.py      # 链接与 sitemap 自检
```

## 与后端的边界

`.cn` 上仍然保留这四类路径（其余页面一律 301 到 `.com`），所以动态能力写成 `.cn` 的绝对地址：

| 地址 | 用途 | 由谁提供 |
| --- | --- | --- |
| `https://game.supuzz.cn/play/` | 网页版游戏入口（当前加密发布包） | feedback-server |
| `https://game.supuzz.cn/downloads/latest.apk` | APK 最新版下载（302 到固定版本） | feedback-server |
| `https://game.supuzz.cn/downloads/latest.apk.sha256` | APK 校验值 | feedback-server |
| `https://game.supuzz.cn/release.json` | 当前 APK/网页版版本；落地页据此解除按钮禁用 | feedback-server |
| `https://game.supuzz.cn/api/game/events` | 下载/点击/加载事件埋点 | feedback-server |
| `https://game.supuzz.cn/api/game/support` 等 | 游戏内打赏、档案 | feedback-server |
| `https://api.supuzz.cn/admin/*` | 后台（游戏发布、统计、打赏） | feedback-server，游戏域名上 404 |

`.cn` 上不会被重定向、必须留在本机的只有：

| 路径 | 为什么不能跳 |
| --- | --- |
| `/play/` | 游戏的真实 origin，存档、CSP 都绑在这里 |
| `/downloads/*` | APK 由后端下发 |
| `/api/*` | 埋点与游戏接口 |
| `/analytics.js` | `/play/` 的 CSP 是 `script-src 'self'`，跳到 `.com` 会被拦掉 |
| `/release.json` | 落地页靠它判断版本；取不到就一直是"按钮置灰"状态 |

四条硬规则：

1. **站内页面链接用根路径**（`/guide.html`），**后端能力用 `.cn` 绝对地址**。两者不能混。
2. 埋点在 `.com` 上是**跨域**上报，浏览器会先发 `OPTIONS` 预检。`game.supuzz.cn` 的 Nginx 已放行三个埋点 location 的 `OPTIONS`（见 `ops/nginx/littlefield.inc`），删掉就会静默丢统计。
3. `/analytics.js` 在 `.cn` 上**不能**参与 301（见上表）。`ops/nginx/littlefield.inc` 里它是单独的 `location =`。
4. `analytics.js` 会按 `location.hostname` 选接口地址：`.cn` 走同源，其它域名跨域到 `.cn`。它同时被后端注入到 `/play/` 的 HTML 里，改名或移动会同时影响两边。

`sitemap.xml` 里除 `/play/` 一条用 `.cn` 外，其余都是 `.com`。

## 本地预览

静态站点起个本地服务器即可（不要用 `file://` 打开，绝对路径会失效）：

```bash
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173/
```

本地预览时指向 `.cn` 的游戏与下载链接会真的连到线上，其余资源都在本地。

## 自检

```bash
python3 scripts/check-links.py   # 站内链接 + sitemap 地址是否都指向真实文件
bash scripts/stage.sh            # 生成 dist/，可顺带检查上线文件清单
```

`deploy.sh` 会先跑它，不通过就不上传。

## 发布

**自动（GitHub Pages → `game.supuzz.com`）**

push 到 `main` 触发 `.github/workflows/deploy.yml`：链接自检 → `scripts/stage.sh` 生成 `dist/` → 只上传 `dist/` 发布。不需要任何 Secrets。

首次使用要在仓库 Settings → Pages 把 **Source 设为 GitHub Actions**。没启用时工作流不会报错，只在日志里提示后跳过。

**手动（阿里云 → `game.supuzz.cn`）**

```bash
bash scripts/deploy.sh
```

`.cn` 现在只服务 `/analytics.js`（其余路径 301 到 `.com`），所以平时用不到；只有改了 `analytics.js`、或需要回滚页面时才跑。第一次用要 `cp deploy.env.example .env.deploy` 填服务器地址（不入库）。

Nginx 配置在 `ops/nginx/`，**不会自动下发**——改配置要手动替换并 `nginx -t`，见 [ops/README.md](ops/README.md)。

## 域名与存档

- 官网在 `game.supuzz.com`（Pages），游戏跑在 `game.supuzz.cn`（阿里云），两者是**不同 origin**。
- 玩家存档（localStorage）绑定 `game.supuzz.cn`。**不要为了命名好看把它换到 `box.supuzz.com` 之类的新域名**——2026-11-02 评估过，会让约 155 台设备（30 天）的农场归零，已决定不迁。
- Android 不受域名影响：游戏包内置在 APK 里，origin 是 `appassets.androidplatform.net`。

## 发布游戏新版本

与改页面无关：登录 <https://api.supuzz.cn/admin/login> → **游戏发布**，上传 APK / 加密游戏 ZIP。落地页的下载与 `/play/` 入口会自动指向新版本，本仓库无需改动，也无需重新部署。

页面与游戏版本是两条独立的发布链路。

## 维护约定

见 [AGENTS.md](AGENTS.md)：新增页面要中英同步、补 `sitemap.xml`、不能直接依赖后端模板变量等。
