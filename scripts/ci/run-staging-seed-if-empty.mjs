#!/usr/bin/env node
/**
 * Run the dev demo seed only when the staging database has no users yet.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/db/src/ssl.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  try {
    await client.connect();
    const result = await client.query('SELECT count(*)::integer AS count FROM "user"');
    const userCount = Number(result.rows[0]?.count ?? 0);
    if (userCount > 0) {
      console.log(
        `[seed] Skipping demo seed: database already has ${userCount} user(s). Use an empty database or operator-approved reset.`,
      );
      return;
    }
    console.log("[seed] Database has no users; running demo seed.");
    const seed = spawnSync("pnpm", ["db:seed"], {
      stdio: "inherit",
      env: process.env,
    });
    if (seed.status !== 0) {
      process.exit(seed.status ?? 1);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
