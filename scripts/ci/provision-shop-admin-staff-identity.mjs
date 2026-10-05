#!/usr/bin/env node
/**
 * Idempotent staff acceptance identity on test auth (email/password).
 * Enrol TOTP separately and store SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET in GitHub test env.
 *
 * Required: DATABASE_URL_OWNER, AUTH_BASE_URL (optional), SHOP_ADMIN_ACCEPTANCE_EMAIL,
 * SHOP_ADMIN_ACCEPTANCE_PASSWORD
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

async function ensureUser(authBase, email, password) {
  const client = new pg.Client(buildPgConnectionConfig(process.env.DATABASE_URL_OWNER ?? ""));
  await client.connect();
  try {
    const existing = await client.query('select id from public."user" where lower(email) = $1', [
      email.toLowerCase(),
    ]);
    if (existing.rowCount) {
      console.log(`shop-admin staff identity already exists (${email})`);
      return existing.rows[0].id;
    }
  } finally {
    await client.end();
  }

  const response = await fetch(`${authBase}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: authBase,
    },
    body: JSON.stringify({
      email,
      password,
      name: "Shop admin acceptance staff",
    }),
  });
  if (!response.ok) {
    throw new Error(`staff sign-up failed (${response.status}): ${await response.text()}`);
  }

  const verifyClient = new pg.Client(buildPgConnectionConfig(process.env.DATABASE_URL_OWNER ?? ""));
  await verifyClient.connect();
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const created = await verifyClient.query(
        'select id from public."user" where lower(email) = $1',
        [email.toLowerCase()],
      );
      if (created.rowCount) {
        console.log(`shop-admin staff identity created (${email}) subject=${created.rows[0].id}`);
        return created.rows[0].id;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("staff user was not persisted within 30 seconds");
  } finally {
    await verifyClient.end();
  }
}

async function main() {
  const email = process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL?.trim();
  const password = process.env.SHOP_ADMIN_ACCEPTANCE_PASSWORD?.trim();
  const databaseUrl = process.env.DATABASE_URL_OWNER?.trim();
  if (!email || !password || !databaseUrl) {
    throw new Error(
      "SHOP_ADMIN_ACCEPTANCE_EMAIL, SHOP_ADMIN_ACCEPTANCE_PASSWORD, and DATABASE_URL_OWNER are required",
    );
  }
  const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
  console.log(`::add-mask::${email}`);
  await ensureUser(authBase, email, password);
  console.log(
    "Next: enrol silver TOTP on this account via test-auth, then set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET on the GitHub test environment.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
