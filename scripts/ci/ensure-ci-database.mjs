#!/usr/bin/env node
/**
 * Ensure the local CI database exists and core services are reachable.
 * Starts docker compose postgres/redis when nothing is listening locally.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/auction_ci";

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function commandExists(name) {
  return spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).status === 0;
}

async function canConnect(url) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function ensureDatabase() {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "") || "auction_ci";
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  if (!(await canConnect(adminUrl.toString()))) {
    if (!commandExists("docker")) {
      console.error(
        "Postgres is not reachable and docker is unavailable. Start postgres/redis (docker compose up -d postgres redis) and retry.",
      );
      process.exit(1);
    }
    console.log("Starting docker compose postgres and redis...");
    run("docker", ["compose", "up", "-d", "postgres", "redis"]);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await canConnect(adminUrl.toString())) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!(await canConnect(adminUrl.toString()))) {
      console.error("Postgres did not become ready after starting docker compose.");
      process.exit(1);
    }
  }

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
    if (existing.rowCount === 0) {
      await admin.query(`create database "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database ${dbName}`);
    }
  } finally {
    await admin.end();
  }

  if (!(await canConnect(databaseUrl))) {
    console.error(`Unable to connect to ${databaseUrl}`);
    process.exit(1);
  }
}

await ensureDatabase();
console.log("CI database ready");
