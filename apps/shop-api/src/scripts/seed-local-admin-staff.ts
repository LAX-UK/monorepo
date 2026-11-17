#!/usr/bin/env node
/**
 * Grants one LAX Admin staff role to each existing dev-seed account
 * (infrastructure/seed/local-admin-staff-seed.ts).
 *
 * Local only: refuses a non-local address, NODE_ENV=production, and any Shop database that is not
 * marked "local". Never creates users; it fails if a dev account is missing (run `pnpm db:seed`
 * first).
 */
import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import pg from "pg";
import { loadShopApiEnv } from "../env.js";
import {
  LOCAL_ADMIN_STAFF,
  assertLocalAddresses,
  grantLocalAdminStaff,
} from "../infrastructure/seed/local-admin-staff-seed.js";

async function resolveSubjects(identityUrl: string): Promise<Map<string, string>> {
  const client = new pg.Client({ connectionString: identityUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string; email: string }>(
      'select id, email from public."user" where lower(email) = any($1)',
      [LOCAL_ADMIN_STAFF.map((entry) => entry.email)],
    );
    return new Map(rows.map((row) => [row.email.toLowerCase(), row.id]));
  } finally {
    await client.end();
  }
}

const env = loadShopApiEnv();
const identityUrl = process.env.DATABASE_URL_AUTH?.trim() || process.env.DATABASE_URL?.trim();
if (!identityUrl) throw new Error("DATABASE_URL_AUTH or DATABASE_URL is required");
const seedEnv = { ...seedTargetEnvFromProcess(), databaseUrl: env.DATABASE_URL_SHOP };
assertLocalAddresses([identityUrl, env.DATABASE_URL_SHOP], seedEnv);

const subjects = await resolveSubjects(identityUrl);
const missing = LOCAL_ADMIN_STAFF.filter((entry) => !subjects.has(entry.email));
if (missing.length > 0) {
  throw new Error(
    `Dev accounts not found: ${missing.map((entry) => entry.email).join(", ")}. Run the dev seed first.`,
  );
}

const db = createDb(env.DATABASE_URL_SHOP);
try {
  await grantLocalAdminStaff(db, seedEnv, subjects);
} finally {
  await closeDb(db);
}
