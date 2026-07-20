import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const [host, user, database] = process.argv.slice(2);
if (!host || !user || !database) {
  console.error("Usage: node scripts/migrate-mariadb.mjs <host> <user> <database>");
  process.exit(2);
}

process.stderr.write("Database password: ");
const password = await new Promise((resolve) => {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = (chunk) => {
      const input = String(chunk);
      if (input === "\u0003") process.exit(130);
      if (input.includes("\r") || input.includes("\n")) {
        value += input.split(/[\r\n]/, 1)[0];
        process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        resolve(value);
        return;
      }
      value += input;
    };
    process.stdin.on("data", onData);
    return;
  }
  process.stdin.once("data", (chunk) => resolve(String(chunk).trimEnd()));
});
process.stderr.write("\n");

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  connectionLimit: 2,
  connectTimeout: 10_000,
  ssl: process.env.ASCO_DB_SSL === "true" ? {} : undefined,
});

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("MariaDB migrations applied successfully.");
} finally {
  await pool.end();
}
