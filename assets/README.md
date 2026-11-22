# 网站漫画版图片

游戏图片来自 FieldApp `main` 的漫画版（提交 `3dbcad0`）实际 WebGL 渲染，截取时仅隐藏界面，没有添加游戏中不存在的角色或建筑。截图浏览器使用临时本机存档与固定镜头，不影响玩家存档。

- `farm-comic.jpg`：1440×1080，首页主视觉。
- `farm-cultivate.jpg`、`farm-explore.jpg`、`farm-build.jpg`：720×480，分别展示菜田、池塘与农舍，中英文首页共用。
- `farm-preview.jpg`：1200×630，分享卡片与文章结构化数据使用的农场全景。
- `icon.svg`：保留幼苗标识，改为麦穗黄色底、森林绿叶片与深棕墨线。
- `favicon-16x16.png`、`favicon-32x32.png`、`favicon-192.png`、`favicon-512.png`、`apple-touch-icon.png`：由 `icon.svg` 栅格化，供浏览器标签页、收藏夹、iOS 主屏与 PWA 使用；根目录 `favicon.ico` 内含 16/32/48 三种尺寸，兼容只请求 `/favicon.ico` 的浏览器。改图标时重新生成这一组文件。
- `countryside.svg`：网站原生矢量天空、云朵与远山背景。

图片已压缩为 JPEG，玩法卡片使用延迟加载，首屏主图优先加载。新增文件需要同时登记到 `src/game-publishing.ts` 的 `SITE_FILES`，才能通过生产路由访问。这个说明文件不在公开白名单中。
