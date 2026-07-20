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
  });

if (process.env.NODE_ENV !== "production") globalForDb.laborPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
