#!/usr/bin/env node
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const databaseUrl = process.env.DATABASE_URL_OWNER?.trim();
const email = (
  process.env.SHOP_OIDC_TEST_EMAIL ??
  process.env.IDENTITY_ACCEPTANCE_EMAIL ??
  ""
).trim();

if (!databaseUrl || !email) {
  console.error(
    "DATABASE_URL_OWNER and SHOP_OIDC_TEST_EMAIL or IDENTITY_ACCEPTANCE_EMAIL are required",
  );
  process.exit(1);
}

const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
await client.connect();
try {
  const result = await client.query(
    'select id from public."user" where lower(email) = lower($1) limit 1',
    [email],
  );
  const subjectId = result.rows[0]?.id;
  if (!subjectId || typeof subjectId !== "string") {
    console.error(`No auth user found for acceptance email ${email}`);
    process.exit(1);
  }
  process.stdout.write(subjectId);
} finally {
  await client.end();
}
