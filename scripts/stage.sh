#!/usr/bin/env bash
# 组装发布目录 dist/：只包含真正要上线的静态文件。
# GitHub Pages 与 ECS 都用它，避免把 .git、ops/、README 之类带上线。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST"

cd "$ROOT"
cp ./*.html "$DIST"/
cp robots.txt sitemap.xml \
   site.css comic.css stories.css \
   site.js guide.js analytics.js "$DIST"/
cp -R assets en "$DIST"/

# macOS 的 ._* 资源叉不要混进去
find "$DIST" -name '._*' -o -name '.DS_Store' | while read -r f; do rm -f "$f"; done

echo "dist/ 已生成：$(find "$DIST" -type f | wc -l | tr -d ' ') 个文件"
