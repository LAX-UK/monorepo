#!/usr/bin/env node
/**
 * Grants one LAX Admin staff role to each existing dev-seed account (packages/db
 * src/seed/dev/legacy-demo-seed.ts), so every role can be signed in locally without inventing
 * identities. Re-running converges on the same roles.
 *
 * Local only: refuses a non-local database or NODE_ENV=production. Never creates users; it fails
 * if a dev account is missing (run `pnpm --filter @auction/db db:seed:dev` first).
 */
import { closeDb, createDb } from "@auction/db";
import type { ShopStaffRole } from "@auction/shop-domain";
import pg from "pg";
import { loadShopApiEnv } from "../env.js";
import { grantShopStaffRole } from "../infrastructure/grant-staff-role.js";

/**
 * broker has no dedicated dev account; gallery-admin is the closest fit because brokers act for
 * gallery-side clients.
 */
export const LOCAL_ADMIN_STAFF: ReadonlyArray<{ role: ShopStaffRole; email: string }> = [
  { role: "shop_admin", email: "admin@lax.bid" },
  { role: "catalogue_editor", email: "staff-catalogue@lax.bid" },
  { role: "operations", email: "staff-operations@lax.bid" },
  { role: "finance", email: "accountant@lax.bid" },
  { role: "account_manager", email: "staff-advisor@lax.bid" },
  { role: "broker", email: "gallery-admin@lax.bid" },
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const OPERATOR = "seed:local-admin-staff";

function assertLocalTarget(urls: readonly string[]): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed local staff: NODE_ENV is production");
  }
  for (const url of urls) {
    const host = new URL(url).hostname;
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(`Refusing to seed local staff: database host "${host}" is not local`);
    }
  }
}

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
assertLocalTarget([identityUrl, env.DATABASE_URL_SHOP]);

const subjects = await resolveSubjects(identityUrl);
const missing = LOCAL_ADMIN_STAFF.filter((entry) => !subjects.has(entry.email));
if (missing.length > 0) {
  throw new Error(
    `Dev accounts not found: ${missing.map((entry) => entry.email).join(", ")}. Run the dev seed first.`,
  );
}

const db = createDb(env.DATABASE_URL_SHOP);
try {
  for (const { role, email } of LOCAL_ADMIN_STAFF) {
    await grantShopStaffRole(db, {
      subject: subjects.get(email) as string,
      role,
      operatorSubjectId: OPERATOR,
    });
    console.log(`${role.padEnd(17)} ${email}`);
  }
} finally {
  await closeDb(db);
}
