import "server-only";

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  laborPool?: mysql.Pool;
};

const pool =
  globalForDb.laborPool ??
  mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // 远程 dev 库/NAT 会掐掉长时间空闲的 TCP 连接，池若继续复用死连接
    // 会抛 ECONNRESET。空闲连接 60 秒即由客户端主动回收。
    idleTimeout: 60_000,
    maxIdle: 2,
  });

if (process.env.NODE_ENV !== "production") globalForDb.laborPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
