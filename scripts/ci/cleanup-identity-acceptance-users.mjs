#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL_OWNER;
  const manifestPath = process.env.ACCEPTANCE_MANIFEST_PATH;
  if (!databaseUrl || !manifestPath) {
    throw new Error("DATABASE_URL_OWNER and ACCEPTANCE_MANIFEST_PATH are required");
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    !Array.isArray(manifest.emails) ||
    manifest.emails.length === 0 ||
    manifest.emails.some((email) => typeof email !== "string" || !email.includes("+lax-"))
  ) {
    throw new Error("Acceptance manifest contains no valid run-scoped emails");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const emails = manifest.emails.map((email) => email.toLowerCase());
    await client.query("begin");
    const users = await client.query(
      'select id from public."user" where lower(email) = any($1::text[]) for update',
      [emails],
    );
    const userIds = users.rows.map((row) => row.id);
    if (userIds.length > 0) {
      await client.query(
        "delete from public.legal_entity where created_by_user_id = any($1::text[])",
        [userIds],
      );
      await client.query('delete from public."user" where id = any($1::text[])', [userIds]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
