#!/usr/bin/env node
import { createHash } from "node:crypto";
import { appendFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const ACCOUNT_LABELS = {
  BID_BFF_TEST_EMAIL: "bid",
  SHOP_OIDC_TEST_EMAIL: "shop",
  REFRESH_TEST_EMAIL: "refresh",
};

/** Mail standards allow 64 characters before the `@`; Zoho CRM refuses a longer address. */
const MAX_LOCAL_PART_LENGTH = 64;
/** Zoho CRM's Email field holds at most 100 characters. */
const MAX_EMAIL_LENGTH = 100;

/**
 * The run's alias of the acceptance mailbox. When the run id does not fit in 64 characters before
 * the `@`, a short hash of it stands in, so every sign-up is still unique to its run and an
 * address Zoho CRM (and other mail systems) can take.
 */
export function deriveAcceptanceEmail(sourceEmail, label, runId) {
  const separator = sourceEmail.lastIndexOf("@");
  if (separator < 1 || separator === sourceEmail.length - 1) {
    throw new Error("IDENTITY_ACCEPTANCE_EMAIL must be a valid email address");
  }
  const local = sourceEmail.slice(0, separator).split("+")[0];
  const domain = sourceEmail.slice(separator + 1);
  const full = `${local}+lax-${label}-acceptance${runId ? `-${runId}` : ""}`;
  const aliasLocal =
    full.length <= MAX_LOCAL_PART_LENGTH || !runId
      ? full
      : `${local}+lax-${label}-${createHash("sha256").update(runId).digest("hex").slice(0, 12)}`;
  const email = `${aliasLocal}@${domain}`.toLowerCase();
  if (aliasLocal.length > MAX_LOCAL_PART_LENGTH || email.length > MAX_EMAIL_LENGTH) {
    throw new Error(
      "IDENTITY_ACCEPTANCE_EMAIL is too long for a run alias: use a mailbox with a shorter name",
    );
  }
  return email;
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
      origin: authBase.replace(/\/+$/, ""),
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
  const runId = process.env.ACCEPTANCE_RUN_ID;
  const manifestPath = process.env.ACCEPTANCE_MANIFEST_PATH;
  const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
  if (!sourceEmail || !password || !databaseUrl || !githubEnv || !runId || !manifestPath) {
    throw new Error(
      "IDENTITY_ACCEPTANCE_EMAIL, IDENTITY_ACCEPTANCE_PASSWORD, DATABASE_URL_OWNER, GITHUB_ENV, ACCEPTANCE_RUN_ID, and ACCEPTANCE_MANIFEST_PATH are required",
    );
  }
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(runId)) {
    throw new Error(
      "ACCEPTANCE_RUN_ID must contain only letters, digits, underscores, and hyphens",
    );
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const emails = [];
    for (const [envName, label] of Object.entries(ACCOUNT_LABELS)) {
      const email = deriveAcceptanceEmail(sourceEmail, label, runId);
      await ensureUser(client, authBase, email, password, label);
      emails.push(email);
      console.log(`::add-mask::${email}`);
      await appendFile(githubEnv, `${envName}=${email}\n`);
    }
    await waitForBidProjection(client, emails);
    await client.query(
      `update public.bid_user_profile p
         set terms_accepted_at = coalesce(p.terms_accepted_at, p.created_at),
             terms_version = coalesce(p.terms_version, 'legacy')
        from public.bid_identity_directory d
        join public."user" u on u.id = d.subject_id
       where p.user_id = d.subject_id
         and lower(u.email) = any($1::text[])`,
      [emails],
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify({ runId, emails, createdAt: new Date().toISOString() }, null, 2)}\n`,
      { mode: 0o600 },
    );
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
