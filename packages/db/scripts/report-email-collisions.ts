/**
 * Run before migration `0057_auth_hardening.sql`.
 * Usage: `DATABASE_URL=... pnpm exec tsx scripts/report-email-collisions.ts` from packages/db.
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../src/ssl.js";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_API;
  if (!url) {
    console.error("Set DATABASE_URL or DATABASE_URL_API");
    process.exit(1);
  }
  const pool = new Pool(buildPgConnectionConfig(url));

  const { rows: emailDups } = await pool.query<{
    e: string;
    ids: string[];
    n: number;
  }>(`
    SELECT lower(trim(email)) AS e,
           array_agg(id ORDER BY created_at) AS ids,
           count(*)::int AS n
    FROM "user"
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  `);

  const { rows: pendingDups } = await pool.query<{
    p: string;
    ids: string[];
    n: number;
  }>(`
    SELECT lower(trim(pending_new_email)) AS p,
           array_agg(id ORDER BY created_at) AS ids,
           count(*)::int AS n
    FROM "user"
    WHERE pending_new_email IS NOT NULL
    GROUP BY lower(trim(pending_new_email))
    HAVING count(*) > 1
  `);

  const { rows: accountDups } = await pool.query<{
    user_id: string;
    provider_id: string;
    n: number;
  }>(`
    SELECT user_id, provider_id, count(*)::int AS n
    FROM account
    GROUP BY user_id, provider_id
    HAVING count(*) > 1
  `);

  await pool.end();

  let bad = false;
  if (emailDups.length > 0) {
    bad = true;
    console.error("Duplicate logical emails (lower(trim)):\n", JSON.stringify(emailDups, null, 2));
  }
  if (pendingDups.length > 0) {
    bad = true;
    console.error("Duplicate pending_new_email:\n", JSON.stringify(pendingDups, null, 2));
  }
  if (accountDups.length > 0) {
    bad = true;
    console.error(
      "Duplicate account (user_id, provider_id):\n",
      JSON.stringify(accountDups, null, 2),
    );
  }

  if (bad) {
    console.error("\nResolve collisions before applying 0057_auth_hardening.sql");
    process.exit(1);
  }
  console.log("No email, pending-email, or account collisions — safe to migrate.");
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
