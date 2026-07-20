#!/usr/bin/env bash
# 启动本地开发用 MariaDB（替代原 docker-compose.yml 的 mariadb 服务）。
# 数据保存在命名卷 asco-tools_mariadb_data，容器删除后数据仍在。
set -euo pipefail

CONTAINER=asco-tools-mariadb
VOLUME=asco-tools_mariadb_data
NETWORK=asco-tools

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker start "$CONTAINER" >/dev/null
else
  docker run -d --name "$CONTAINER" \
    --network "$NETWORK" \
    --restart unless-stopped \
    -e MARIADB_DATABASE=labor_insurance \
    -e MARIADB_USER=labor_app \
    -e MARIADB_PASSWORD=labor_app_password \
    -e MARIADB_ROOT_PASSWORD=local_root_password \
    -e MARIADB_AUTO_UPGRADE=1 \
    -p 3306:3306 \
    -v "$VOLUME":/var/lib/mysql \
    --health-cmd 'healthcheck.sh --connect --innodb_initialized' \
    --health-interval 5s \
    --health-timeout 3s \
    --health-retries 20 \
    mariadb:12.3 >/dev/null
fi

echo -n "Waiting for MariaDB to become healthy"
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")
  if [ "$status" = "healthy" ]; then
    echo
    echo "MariaDB is ready (container: $CONTAINER, volume: $VOLUME, port: 3306)"
    exit 0
  fi
  echo -n "."
  sleep 1
done

echo
echo "MariaDB did not become healthy in time; check: docker logs $CONTAINER" >&2
exit 1
