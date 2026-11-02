#!/usr/bin/env bash
# 部署田野之间静态落地页到 ECS。
#
# 用法：
#   bash scripts/deploy.sh            # 只上传
#   bash scripts/deploy.sh --reload   # 上传后执行 nginx -t && systemctl reload nginx
#
# 需要先准备 .env.deploy（见 deploy.env.example），或直接用环境变量传参。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi

: "${DEPLOY_SSH_HOST:?未设置 DEPLOY_SSH_HOST（ECS 公网 IP 或域名）。请从 deploy.env.example 复制一份 .env.deploy 并填写。}"
DEPLOY_SSH_USER="${DEPLOY_SSH_USER:-root}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_REMOTE_PATH="${DEPLOY_REMOTE_PATH:-/var/www/littlefield}"

# 防呆：/usr/share/nginx/html 是 supuzz.cn 公司官网的目录，绝不能覆盖
case "${DEPLOY_REMOTE_PATH%/}" in
  ""|/|/usr/share/nginx/html)
    echo "拒绝部署：DEPLOY_REMOTE_PATH=${DEPLOY_REMOTE_PATH} 不是本站专属目录" >&2
    echo "本站默认 /var/www/littlefield；/usr/share/nginx/html 属于 supuzz.cn 公司官网。" >&2
    exit 1
    ;;
esac

RELOAD=0
for arg in "$@"; do
  case "$arg" in
    --reload) RELOAD=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "未知参数：$arg（可用：--reload）" >&2; exit 1 ;;
  esac
done

TARGET="${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"
SSH=(ssh -p "$DEPLOY_SSH_PORT" "$TARGET")

# 发布前先自检，链接断了就别上线
if command -v python3 >/dev/null 2>&1; then
  python3 "$ROOT/scripts/check-links.py"
fi

echo "==> 上传到 ${TARGET}:${DEPLOY_REMOTE_PATH}"

# 先解到 .next，再整体换目录，避免上传中断时出现半套页面。
"${SSH[@]}" "set -e; mkdir -p '${DEPLOY_REMOTE_PATH}'; rm -rf '${DEPLOY_REMOTE_PATH}.next'; mkdir -p '${DEPLOY_REMOTE_PATH}.next'"

# 只上传 dist/（由 scripts/stage.sh 生成的发布目录）
bash "$ROOT/scripts/stage.sh"
COPYFILE_DISABLE=1 tar czf - -C "$ROOT/dist" . | "${SSH[@]}" "tar xzf - --no-same-owner -C '${DEPLOY_REMOTE_PATH}.next'"

"${SSH[@]}" "set -e
if [ -d '${DEPLOY_REMOTE_PATH}' ]; then rm -rf '${DEPLOY_REMOTE_PATH}.prev'; mv '${DEPLOY_REMOTE_PATH}' '${DEPLOY_REMOTE_PATH}.prev'; fi
mv '${DEPLOY_REMOTE_PATH}.next' '${DEPLOY_REMOTE_PATH}'"

if [ "$RELOAD" = 1 ]; then
  "${SSH[@]}" "nginx -t && systemctl reload nginx"
fi

echo "==> 完成。上一版保留在 ${DEPLOY_REMOTE_PATH}.prev"
echo "    回滚：ssh ${TARGET} \"rm -rf ${DEPLOY_REMOTE_PATH}.bad && mv ${DEPLOY_REMOTE_PATH} ${DEPLOY_REMOTE_PATH}.bad && mv ${DEPLOY_REMOTE_PATH}.prev ${DEPLOY_REMOTE_PATH}\""
