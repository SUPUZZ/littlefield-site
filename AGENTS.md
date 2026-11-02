# 田野之间落地页 · 维护约定

本仓库是 `game.supuzz.com`（唯一主站）的静态落地页；`game.supuzz.cn` 只保留游戏与接口，其余页面 301 到 `.com`，**没有构建步骤**，push `main` 会自动经 `scripts/stage.sh` 生成 `dist/` 并发布到 GitHub Pages。

## 硬性边界

- 只写静态资源。不要引入打包器、框架、Node 构建流程或 `node_modules`；改完直接刷新浏览器就能看到效果。
- 不实现后端能力。`/play/`、`/downloads/*`、`/api/*` 都由 `feedback-server` 提供（在 `.cn` 上），这里只写指向它们的链接，不要在本仓库放同名目录去"接管"这些路径。
- 新增上线文件必须同时加进 `scripts/stage.sh` 的白名单，否则不会出现在 `dist/` 里。
- 不动 `analytics.js` 的接口路径与事件名（`apk_download`、`web_launch`、加载成功等）。后端在 `/play/` 的 HTML 里注入同一个文件，改动会同时影响落地页与游戏内统计。

## 域名与链接规则

- **canonical / og:url / og:image / hreflang / sitemap / robots 的 `Sitemap:` 一律用 `https://game.supuzz.com`**（主站）。
- **游戏与下载必须用 `https://game.supuzz.cn/...` 绝对地址**（Pages 没有反向代理，写成 `/play/` 会 404）。
- 普通页面之间的跳转仍用根路径（`/guide.html`），因为两个域名都是同一份文件树。
- `sitemap.xml` 里只有 `/play/` 一条用 `.cn`，其余用 `.com`。
- `.cn` 上除 `/play/`、`/downloads/`、`/api/`、`/analytics.js` 外一律 301 到 `.com`。往 `.cn` 加任何"需要在 .cn 直接打开"的路径，都要先改 `ops/nginx/littlefield.inc`。

## 页面与语言

- 中文放在根目录，英文放在 `en/`，两边**结构对应**：`index.html` ↔ `en/index.html`，`guide.html` ↔ `en/guide.html`，`privacy.html` ↔ `en/privacy.html`。
- 改中文页的可见文案时同步改英文页；链接不要跨语言串（英文页指向 `/play/?lang=en`）。
- 新增可索引页面时：
  1. 在对应语言目录加 HTML；
  2. 更新 `sitemap.xml`（首页与图鉴带 `hreflang` 组，长文页面单独一条）；
  3. 检查 `robots.txt` 是否需要新增 `Disallow`（`privacy.html` 目前不收录）。
- 站内链接一律用根路径（以 `/` 开头），不要用相对路径——页面分布在根目录与 `en/` 两处，相对路径会串。

## 样式与资源

- 全站共享 `site.css`；`comic.css` 是漫画风覆盖层，加载在 `site.css` 之后，改视觉优先改这里。
- 玩法长文共用 `stories.css`；图鉴页用 `guide.js`。
- 图片放 `assets/`，新增图片先压到合适尺寸并补进 `assets/README.md` 的来源说明。
- 首页与图鉴页都有 `data-game-event` 埋点属性，新增下载/游玩按钮时沿用 `apk_download` / `web_launch`，不要自造事件名。
- `.com` 上的埋点是跨域上报，依赖 `game.supuzz.cn` 的 Nginx 放行 `OPTIONS`；不要顺手把 `ops/nginx/littlefield.inc` 里那三个 `limit_except` 改回只允许 POST。

## 提交前自检

- `python3 scripts/check-links.py` 必须通过（工作流第一步就是它，不通过不会发布）。
- `bash scripts/stage.sh` 后确认 `dist/` 里有你新增的文件。
- 本地 `python3 -m http.server 4173` 打开首页、图鉴、英文首页，确认没有 404 的样式/图片。
- `git diff --check` 无空白错误。
- 确认没有把 `.env.deploy`、`.DS_Store` 提交进来。
- 改了 `ops/nginx/` 不会随 push 生效：需要在服务器上手动替换并 `nginx -t`。
