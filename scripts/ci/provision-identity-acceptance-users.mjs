#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const ACCOUNT_LABELS = {
  BID_BFF_TEST_EMAIL: "bid",
  SHOP_OIDC_TEST_EMAIL: "shop",
  REFRESH_TEST_EMAIL: "refresh",
};

export function deriveAcceptanceEmail(sourceEmail, label) {
  const separator = sourceEmail.lastIndexOf("@");
  if (separator < 1 || separator === sourceEmail.length - 1) {
    throw new Error("IDENTITY_ACCEPTANCE_EMAIL must be a valid email address");
  }
  const local = sourceEmail.slice(0, separator).split("+")[0];
  const domain = sourceEmail.slice(separator + 1);
  return `${local}+lax-${label}-acceptance@${domain}`.toLowerCase();
}

async function ensureUser(client, authBase, email, password, label) {
  const existing = await client.query('select 1 from public."user" where lower(email) = $1', [
    email,
  ]);
  if (existing.rowCount) return;

  const response = await fetch(`${authBase}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: process.env.WEB_ORIGIN ?? "https://test.lax.bid",
    },
    body: JSON.stringify({
      email,
      password,
      name: `Identity ${label} acceptance`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `failed to provision ${label} acceptance user (${response.status}): ${await response.text()}`,
    );
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const created = await client.query('select 1 from public."user" where lower(email) = $1', [
      email,
    ]);
    if (created.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} acceptance user was not persisted within 30 seconds`);
}

async function waitForBidProjection(client, emails) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await client.query(
      `select count(*)::int as projected
         from public."user" u
         join public.bid_identity_directory d on d.subject_id = u.id
         join public.bid_user_profile p on p.user_id = u.id
        where lower(u.email) = any($1::text[])`,
      [emails],
    );
    if (Number(result.rows[0]?.projected ?? 0) === emails.length) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("acceptance accounts were not projected to Bid within 60 seconds");
}

async function main() {
  const sourceEmail = process.env.IDENTITY_ACCEPTANCE_EMAIL;
  const password = process.env.IDENTITY_ACCEPTANCE_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL_OWNER;
  const githubEnv = process.env.GITHUB_ENV;
  const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
  if (!sourceEmail || !password || !databaseUrl || !githubEnv) {
    throw new Error(
      "IDENTITY_ACCEPTANCE_EMAIL, IDENTITY_ACCEPTANCE_PASSWORD, DATABASE_URL_OWNER, and GITHUB_ENV are required",
    );
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const emails = [];
    for (const [envName, label] of Object.entries(ACCOUNT_LABELS)) {
      const email = deriveAcceptanceEmail(sourceEmail, label);
      await ensureUser(client, authBase, email, password, label);
      emails.push(email);
      console.log(`::add-mask::${email}`);
      await appendFile(githubEnv, `${envName}=${email}\n`);
    }
    await waitForBidProjection(client, emails);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
