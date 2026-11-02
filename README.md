# 田野之间 · 游戏落地页（Little Field Site）

《田野之间》的**静态落地页站点**，一份源码发布到两个地址：

| 域名 | 托管 | 角色 |
| --- | --- | --- |
| <https://game.supuzz.com/> | GitHub Pages | **主站**，canonical 指向这里 |
| <https://game.supuzz.cn/> | 阿里云 ECS（Nginx 静态目录） | 镜像；游戏与接口也在这台 |

中文在根目录、英文在 `en/`。

本仓库只负责**页面本身**：介绍页、田园图鉴、玩法长文、隐私政策、样式、图标与埋点脚本。游戏运行包、APK 下载、后台管理仍然由 `feedback-server`（`api.supuzz.cn`）提供，本仓库不包含任何后端代码。

## 技术形态

- 纯静态 HTML + CSS + 原生 JS，**没有构建步骤**。
- `scripts/stage.sh` 按白名单把站点文件复制到 `dist/`，两个部署目标都上传 `dist/`。
- 部署：push `main` → 自检 → 并行发 GitHub Pages 和 ECS。

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
└── scripts/check-links.py      # 链接与 sitemap 自检（CI 前置）
```

## 与后端的边界

Pages 只能托管静态文件，**没有反向代理**，所以动态能力一律写成 `.cn` 的绝对地址（`.cn` 上依旧可用）：

| 地址 | 用途 | 由谁提供 |
| --- | --- | --- |
| `https://game.supuzz.cn/play/` | 网页版游戏入口（当前加密发布包） | feedback-server |
| `https://game.supuzz.cn/downloads/latest.apk` | APK 最新版下载（302 到固定版本） | feedback-server |
| `https://game.supuzz.cn/downloads/latest.apk.sha256` | APK 校验值 | feedback-server |
| `https://game.supuzz.cn/api/game/events` | 下载/点击/加载事件埋点 | feedback-server |
| `https://game.supuzz.cn/api/game/support` 等 | 游戏内打赏、档案 | feedback-server |
| `https://api.supuzz.cn/admin/*` | 后台（游戏发布、统计、打赏） | feedback-server，游戏域名上 404 |

三条硬规则：

1. **站内页面链接用根路径**（`/guide.html`），**后端能力用 `.cn` 绝对地址**。两者不能混。
2. 埋点在 `.com` 上是**跨域**上报，浏览器会先发 `OPTIONS` 预检。`game.supuzz.cn` 的 Nginx 已放行三个埋点 location 的 `OPTIONS`（见 `ops/nginx/littlefield.inc`），删掉就会静默丢统计。
3. `analytics.js` 会按 `location.hostname` 选接口地址：`.cn` 走同源，其它域名跨域到 `.cn`。它同时被后端注入到 `/play/` 的 HTML 里，改名或移动会同时影响两边。

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

CI 在每次部署前跑同一个脚本，失败就不会上线。

## 部署

**自动**：push 到 `main` → 自检 → 并行部署两个目标（`.github/workflows/deploy.yml`，也可在 Actions 页手动触发）：

| 目标 | 需要什么 |
| --- | --- |
| GitHub Pages → `game.supuzz.com` | 仓库 Settings → Pages → Source 选 **GitHub Actions**，Custom domain 填 `game.supuzz.com`；DNS 上加 `game.supuzz.com CNAME supuzz.github.io` |
| ECS → `game.supuzz.cn` | 下面这些 Secrets |

ECS 目标需要仓库 Secrets：

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
bash scripts/stage.sh && bash scripts/deploy.sh   # 只发 ECS
bash scripts/deploy.sh --reload     # 上传后顺便 nginx -t && reload
```

Nginx 配置见 `ops/nginx/`，**不随 CI 自动下发**（改配置风险高，手动改完 `nginx -t` 再 reload）。首次切换步骤见 [ops/README.md](ops/README.md)。

## 发布游戏新版本

与改页面无关：登录 <https://api.supuzz.cn/admin/login> → **游戏发布**，上传 APK / 加密游戏 ZIP。落地页的下载与 `/play/` 入口会自动指向新版本，本仓库无需改动，也无需重新部署。

页面与游戏版本是两条独立的发布链路。

## 维护约定

见 [AGENTS.md](AGENTS.md)：新增页面要中英同步、补 `sitemap.xml`、不能直接依赖后端模板变量等。
