#!/usr/bin/env bash
# 构建生产镜像并启动应用容器（替代原 docker-compose.yml 的 app 服务）。
# 数据库等配置的优先级：外部环境变量 > .env.local > 本地 mariadb 容器回退值。
# .env.local 存在时会整体转发进容器（Stripe、ADMIN_EMAILS 等）；
# 注意其中指向 127.0.0.1 的地址在容器内不可达，需用远程地址或容器主机名。
# 使用本地库回退值时，先执行 scripts/dev-db.sh 确保 MariaDB 已就绪。
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=asco-tools:latest
CONTAINER=asco-tools-app
NETWORK=asco-tools
DB_CONTAINER=asco-tools-mariadb

# 记住外部显式传入的值，避免被 .env.local 覆盖
EXT_DATABASE_URL="${DATABASE_URL:-}"
EXT_BETTER_AUTH_URL="${BETTER_AUTH_URL:-}"
EXT_BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-}"

ENV_FILE_ARGS=""
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
  ENV_FILE_ARGS="--env-file .env.local"
fi

DATABASE_URL="${EXT_DATABASE_URL:-${DATABASE_URL:-mysql://labor_app:labor_app_password@${DB_CONTAINER}:3306/labor_insurance}}"
BETTER_AUTH_URL="${EXT_BETTER_AUTH_URL:-${BETTER_AUTH_URL:-http://localhost:3000}}"
BETTER_AUTH_SECRET="${EXT_BETTER_AUTH_SECRET:-${BETTER_AUTH_SECRET:-local-development-secret-change-before-production}}"

# --load：buildx 使用 docker-container driver 时也把镜像载入本地
docker build --load -t "$IMAGE" .

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# shellcheck disable=SC2086  # ENV_FILE_ARGS 需要按词拆分
docker run -d --name "$CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  $ENV_FILE_ARGS \
  -e DATABASE_URL="$DATABASE_URL" \
  -e BETTER_AUTH_URL="$BETTER_AUTH_URL" \
  -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  -p 3000:3000 \
  "$IMAGE" >/dev/null

echo "app is running at http://localhost:3000 (container: $CONTAINER)"
echo "stop with: docker stop $CONTAINER"
