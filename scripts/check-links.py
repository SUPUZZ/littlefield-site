#!/usr/bin/env python3
"""静态站自检：站内链接与 sitemap 是否都指向真实文件。

无第三方依赖，CI 与本地都跑同一个脚本：

    python3 scripts/check-links.py

规则：
  - 站内绝对路径（以 / 开头）从仓库根目录解析，相对路径按所在页面解析；
  - 以目录结尾的路径按 index.html 处理（/en/ -> en/index.html）；
  - /play、/downloads、/api 由后端提供，只校验前缀白名单，不要求文件存在；
  - sitemap.xml 里的 game.supuzz.cn 地址必须能落到真实页面，或者属于上面三个前缀。
"""

from __future__ import annotations

import os
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_PREFIXES = ("/play", "/downloads", "/api")
SKIP_SCHEMES = ("//", "mailto:", "tel:", "data:", "javascript:")
# 两个域名伺服同一份文件；.cn 额外承载后端路径，所以按路径判断而不是按域名。
OWN_HOSTS = {"game.supuzz.cn", "game.supuzz.com"}

errors: list[str] = []


def is_backend_path(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in BACKEND_PREFIXES)


def resolve(page: str, url: str) -> str | None:
    """把站内 URL 解析成仓库内的绝对文件路径；返回 None 表示由后端提供或站外链接。"""
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https"):
        if parsed.netloc not in OWN_HOSTS:
            return None  # 站外链接，不管
        path = parsed.path
    else:
        path = url.split("#")[0].split("?")[0]
    if not path:
        return None  # 纯锚点
    if path.startswith("/"):
        rel = path.lstrip("/")
    else:
        rel = os.path.normpath(os.path.join(os.path.dirname(page), path))
        rel = rel.lstrip("./")
    if is_backend_path("/" + rel):
        return None
    abs_path = os.path.normpath(os.path.join(ROOT, rel))
    if not (abs_path == ROOT or abs_path.startswith(ROOT + os.sep)):
        errors.append(f"越界路径: {page} -> {url}")
        return None
    if os.path.isdir(abs_path) or path.endswith("/"):
        abs_path = os.path.join(abs_path, "index.html")
    return abs_path


def check_html() -> int:
    pages = sorted(p for p in os.listdir(ROOT) if p.endswith(".html"))
    en_dir = os.path.join(ROOT, "en")
    if os.path.isdir(en_dir):
        pages += [f"en/{p}" for p in sorted(os.listdir(en_dir)) if p.endswith(".html")]

    checked = 0
    for page in pages:
        with open(os.path.join(ROOT, page), encoding="utf-8") as fh:
            html = fh.read()
        for url in re.findall(r'(?:href|src)="([^"]+)"', html):
            if url.startswith(SKIP_SCHEMES) or url.startswith("#"):
                continue
            target = resolve(page, url)
            checked += 1
            if target is None:
                continue
            if not os.path.isfile(target):
                errors.append(f"{page}: 链接不存在 -> {url}")
    return checked


def check_sitemap() -> int:
    path = os.path.join(ROOT, "sitemap.xml")
    if not os.path.isfile(path):
        errors.append("缺少 sitemap.xml")
        return 0
    tree = ET.parse(path)
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    count = 0
    for loc in tree.getroot().iterfind(".//s:loc", ns):
        url = (loc.text or "").strip()
        parsed = urlparse(url)
        if parsed.netloc not in OWN_HOSTS:
            errors.append(f"sitemap 域名不属于本站: {url}")
            continue
        # 后端地址（/play/ 等）只存在于 .cn，不能写成 .com
        if is_backend_path(parsed.path or "/"):
            count += 1
            if parsed.netloc != "game.supuzz.cn":
                errors.append(f"sitemap 中的后端地址必须是 game.supuzz.cn: {url}")
            continue
        target = resolve("sitemap.xml", parsed.path or "/")
        count += 1
        if target is None:
            continue
        if not os.path.isfile(target):
            errors.append(f"sitemap 指向不存在的页面: {url}")
    return count


def main() -> int:
    links = check_html()
    sitemap_urls = check_sitemap()
    print(f"站内链接 {links} 条，sitemap 地址 {sitemap_urls} 条")
    if errors:
        print(f"\n发现 {len(errors)} 个问题：")
        for err in errors:
            print(f"  - {err}")
        return 1
    print("自检通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
