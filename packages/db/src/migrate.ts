import pg from "pg";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const pool = new pg.Pool(buildPgConnectionConfig(url));
  try {
    await runMigrationsPerTransaction(pool);
  } finally {
    await pool.end();
  }
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
