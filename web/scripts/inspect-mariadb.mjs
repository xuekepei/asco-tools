import mysql from "mysql2/promise";

const [host, user, database, mode] = process.argv.slice(2);
if (!host || !user) {
  console.error("Usage: node scripts/inspect-mariadb.mjs <host> <user>");
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

const connection = await mysql.createConnection({
  host,
  user,
  password,
  database,
  connectTimeout: 10_000,
  ssl: process.env.ASCO_DB_SSL === "true" ? {} : undefined,
});

try {
  const [[version]] = await connection.query(
    "SELECT VERSION() AS version, @@character_set_server AS characterSet, @@collation_server AS collation",
  );
  const [databases] = await connection.query("SHOW DATABASES");
  const [tables] = database ? await connection.query("SHOW FULL TABLES") : [[]];
  const [grants] = await connection.query("SHOW GRANTS FOR CURRENT_USER()");
  const schema = database
    ? (
        await connection.query(
          "SELECT DEFAULT_CHARACTER_SET_NAME AS characterSet, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()",
        )
      )[0][0]
    : null;
  const [tableDetails] = database
    ? await connection.query(
        "SELECT TABLE_NAME AS tableName, ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      )
    : [[]];
  const [foreignKeys] = database
    ? await connection.query(
        "SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS constraintName, REFERENCED_TABLE_NAME AS referencedTable, DELETE_RULE AS deleteRule FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME",
      )
    : [[]];
  const [indexes] = database
    ? await connection.query(
        "SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME",
      )
    : [[]];
  const migrationTableExists = tables.some((row) => Object.values(row)[0] === "__drizzle_migrations");
  const [migrations] = migrationTableExists
    ? await connection.query(
        "SELECT id, LEFT(hash, 12) AS hashPrefix, created_at AS createdAt FROM __drizzle_migrations ORDER BY id",
      )
    : [[]];
  if (mode === "--renewal-summary") {
    const tableNames = tables.map((row) => Object.values(row)[0]);
    const renewalTable = tableDetails.find((row) => row.tableName === "renewal_declaration");
    console.log(JSON.stringify({
      oldTableExists: tableNames.includes("declaration"),
      renewalTable: renewalTable ?? null,
      migrationCount: migrations.length,
      latestMigration: migrations.at(-1) ?? null,
      renewalForeignKeys: foreignKeys.filter((row) => row.tableName === "renewal_declaration"),
      renewalIndexes: indexes.filter((row) => row.tableName === "renewal_declaration"),
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      version,
      databases: databases.map((row) => row.Database),
      selectedDatabase: database || null,
      schema,
      tables: tables.map((row) => Object.values(row)[0]),
      tableDetails,
      migrations,
      foreignKeys,
      indexes,
      grants: grants.map((row) => Object.values(row)[0]),
    }, null, 2));
  }
} finally {
  await connection.end();
}
