#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL_OWNER;
  const manifestPath = process.env.ACCEPTANCE_MANIFEST_PATH;
  if (!databaseUrl || !manifestPath) {
    throw new Error(
      "DATABASE_URL_OWNER and ACCEPTANCE_MANIFEST_PATH are required",
    );
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    !Array.isArray(manifest.emails) ||
    manifest.emails.length === 0 ||
    manifest.emails.some(
      (email) => typeof email !== "string" || !email.includes("+lax-"),
    )
  ) {
    throw new Error("Acceptance manifest contains no valid run-scoped emails");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    await client.query(
      'delete from public."user" where lower(email) = any($1::text[])',
      [manifest.emails.map((email) => email.toLowerCase())],
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
