#!/usr/bin/env bash
# 构建生产镜像并启动应用容器（替代原 docker-compose.yml 的 app 服务）。
# 先执行 scripts/dev-db.sh 确保 MariaDB 已就绪。
# 环境变量可通过外部覆盖：DATABASE_URL / BETTER_AUTH_URL / BETTER_AUTH_SECRET。
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=asco-tools:latest
CONTAINER=asco-tools-app
NETWORK=asco-tools
DB_CONTAINER=asco-tools-mariadb

# --load：buildx 使用 docker-container driver 时也把镜像载入本地
docker build --load -t "$IMAGE" .

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

docker run -d --name "$CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  -e DATABASE_URL="${DATABASE_URL:-mysql://labor_app:labor_app_password@${DB_CONTAINER}:3306/labor_insurance}" \
  -e BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}" \
  -e BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-local-development-secret-change-before-production}" \
  -p 3000:3000 \
  "$IMAGE" >/dev/null

echo "app is running at http://localhost:3000 (container: $CONTAINER)"
echo "stop with: docker stop $CONTAINER"
