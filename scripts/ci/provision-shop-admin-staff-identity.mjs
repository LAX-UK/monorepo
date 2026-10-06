#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Idempotent staff acceptance identity on test auth (email/password + silver TOTP).
 *
 * Required: DATABASE_URL_AUTH (or DATABASE_URL_OWNER), SHOP_ADMIN_ACCEPTANCE_PASSWORD, and either
 * SHOP_ADMIN_ACCEPTANCE_EMAIL or IDENTITY_ACCEPTANCE_EMAIL (derive).
 * After first enrolment, set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET on the GitHub test env
 * (script attempts `gh secret set` when GITHUB_TOKEN can write environment secrets).
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { Secret, TOTP } from "otpauth";
import pg from "pg";
import {
  createEnvelopeCrypto,
  parseAuthDekKey,
} from "../../packages/identity-contracts/src/auth-at-rest.ts";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";
import { deriveAcceptanceEmail } from "./provision-identity-acceptance-users.mjs";

function captureCookies(response, jar) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const part of raw) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) {
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function parseTotpSecretFromUri(totpUri) {
  const url = new URL(totpUri);
  const secret = url.searchParams.get("secret");
  if (!secret) {
    throw new Error("TOTP URI did not include a secret parameter");
  }
  return secret;
}

function authDatabaseUrl() {
  const auth = process.env.DATABASE_URL_AUTH?.trim();
  if (auth) return auth;
  const owner = process.env.DATABASE_URL_OWNER?.trim();
  if (owner) return owner;
  return "";
}

async function withOwnerClient(fn) {
  const client = new pg.Client(buildPgConnectionConfig(authDatabaseUrl()));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function isTwoFactorEnabled(email) {
  return withOwnerClient(async (client) => {
    const result = await client.query(
      'select two_factor_enabled from public."user" where lower(email) = $1',
      [email.toLowerCase()],
    );
    return Boolean(result.rows[0]?.two_factor_enabled);
  });
}

async function clearTwoFactorState(email) {
  await withOwnerClient(async (client) => {
    await client.query(
      `delete from public.two_factor
       where user_id = (select id from public."user" where lower(email) = $1)`,
      [email.toLowerCase()],
    );
    await client.query(
      'update public."user" set two_factor_enabled = false where lower(email) = $1',
      [email.toLowerCase()],
    );
  });
}

/** Test-only fallback when Better Auth enable returns 5xx; writes at-rest sealed TOTP like auth adapter. */
async function bootstrapStaffTotpAtRest(email, dekKeyRaw) {
  const crypto = createEnvelopeCrypto(parseAuthDekKey(dekKeyRaw));
  const totpSecret = new Secret({ size: 20 }).base32;
  const backupCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
  const sealedSecret = crypto.seal(totpSecret);
  const sealedBackup = crypto.seal(JSON.stringify(backupCodes));
  await withOwnerClient(async (client) => {
    const userRes = await client.query('select id from public."user" where lower(email) = $1', [
      email.toLowerCase(),
    ]);
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      throw new Error("staff user missing while bootstrapping TOTP");
    }
    await client.query("delete from public.two_factor where user_id = $1", [userId]);
    await client.query(
      `insert into public.two_factor (id, secret, backup_codes, user_id, verified)
       values ($1, $2, $3, $4, true)`,
      [randomBytes(16).toString("hex"), sealedSecret, sealedBackup, userId],
    );
    await client.query('update public."user" set two_factor_enabled = true where id = $1', [
      userId,
    ]);
  });
  return totpSecret;
}

function exportTotpSecretForWorkflowJob(secret) {
  const envFile = process.env.GITHUB_ENV?.trim();
  if (envFile) {
    appendFileSync(envFile, `SHOP_ACCEPTANCE_PROVISIONED_TOTP_SECRET=${secret}\n`);
  }
  const totpFile = process.env.SHOP_ACCEPTANCE_STAFF_TOTP_FILE?.trim();
  if (totpFile) {
    writeFileSync(totpFile, `${secret}\n`, { mode: 0o600 });
  }
}

function persistTotpSecretOnGithub(secret) {
  exportTotpSecretForWorkflowJob(secret);
  const configured =
    process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim() ||
    process.env.SHOP_ACCEPTANCE_PROVISIONED_TOTP_SECRET?.trim();
  if (configured && configured !== secret) {
    console.log(
      "::warning::replacing staff acceptance TOTP secret for this run (auth DB was re-enrolled)",
    );
  }
  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.log(
      "::warning::Set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET on the GitHub test environment (enrolment secret was masked above)",
    );
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
  const result = spawnSync(
    "gh",
    [
      "secret",
      "set",
      "SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET",
      "--repo",
      repo,
      "--env",
      "test",
      "--body",
      secret,
    ],
    { encoding: "utf8", env: { ...process.env } },
  );
  if (result.status === 0) {
    console.log("SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET stored on GitHub test environment");
  } else {
    console.log(
      `::warning::Could not persist TOTP secret via gh (${result.stderr || result.stdout}); set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET manually`,
    );
  }
}

async function signInStaff(authBase, email, password) {
  const jar = new Map();
  const signIn = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: authBase,
    },
    body: JSON.stringify({ email, password }),
  });
  captureCookies(signIn, jar);
  const raw = await signIn.text();
  let body = {};
  try {
    body = JSON.parse(raw);
  } catch {
    body = {};
  }
  if (!signIn.ok) {
    throw new Error(`staff sign-in failed (${signIn.status}): ${raw}`);
  }
  return { jar, twoFactorRedirect: Boolean(body.twoFactorRedirect) };
}

async function assertTotpAcceptedByAuth(authBase, email, password, totpSecret) {
  const { jar, twoFactorRedirect } = await signInStaff(authBase, email, password);
  if (!twoFactorRedirect) {
    throw new Error("expected twoFactorRedirect when verifying staff TOTP enrolment");
  }
  const code = new TOTP({ secret: totpSecret }).generate();
  const verify = await fetch(`${authBase}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: authBase,
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ code, trustDevice: true }),
  });
  captureCookies(verify, jar);
  if (!verify.ok) {
    throw new Error(
      `staff TOTP verification failed against test-auth (${verify.status}): ${await verify.text()}`,
    );
  }
}

async function ensureSilverTotp(authBase, email, password) {
  const configuredSecret = process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
  if (await isTwoFactorEnabled(email)) {
    if (configuredSecret) {
      try {
        await assertTotpAcceptedByAuth(authBase, email, password, configuredSecret);
        console.log("shop-admin staff TOTP already enabled and verified");
        persistTotpSecretOnGithub(configuredSecret);
        return;
      } catch (error) {
        console.log(
          `::warning::stored SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET did not verify; re-enrolling (${error instanceof Error ? error.message : String(error)})`,
        );
        await clearTwoFactorState(email);
      }
    } else {
      console.log(
        "::warning::shop-admin staff has TOTP enabled in auth DB without a verified secret; clearing for re-enrolment",
      );
      await clearTwoFactorState(email);
    }
  }

  let { jar, twoFactorRedirect } = await signInStaff(authBase, email, password);
  if (twoFactorRedirect) {
    console.log(
      "::warning::staff sign-in returned twoFactorRedirect before enable; clearing 2FA state and retrying sign-in",
    );
    await clearTwoFactorState(email);
    ({ jar, twoFactorRedirect } = await signInStaff(authBase, email, password));
    if (twoFactorRedirect) {
      throw new Error(
        "staff sign-in still requires two-factor after clearing state; set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET or fix auth DB",
      );
    }
  }

  async function callEnable() {
    const response = await fetch(`${authBase}/api/auth/two-factor/enable`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: authBase,
        cookie: cookieHeader(jar),
      },
      body: JSON.stringify({ password }),
    });
    captureCookies(response, jar);
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }

  let { response: enable, body: enableBody } = await callEnable();
  if (!enable.ok) {
    if (await isTwoFactorEnabled(email)) {
      console.log(
        "::warning::two-factor enable failed but DB shows enabled; clearing partial enrolment",
      );
      await clearTwoFactorState(email);
      ({ jar } = await signInStaff(authBase, email, password));
      ({ response: enable, body: enableBody } = await callEnable());
    }
  }
  if (!enable.ok) {
    console.log("::warning::two-factor enable failed; clearing partial state and retrying once");
    await clearTwoFactorState(email);
    ({ jar } = await signInStaff(authBase, email, password));
    ({ response: enable, body: enableBody } = await callEnable());
  }
  if (!enable.ok) {
    const dek = process.env.AUTH_DEK_KEY?.trim();
    if (dek) {
      console.log(
        `::warning::two-factor enable failed (${enable.status}); bootstrapping staff TOTP via auth at-rest`,
      );
      const bootstrapped = await bootstrapStaffTotpAtRest(email, dek);
      await assertTotpAcceptedByAuth(authBase, email, password, bootstrapped);
      console.log(`::add-mask::${bootstrapped}`);
      console.log("shop-admin staff silver TOTP bootstrapped for acceptance");
      persistTotpSecretOnGithub(bootstrapped);
      return;
    }
    throw new Error(
      `two-factor enable failed (${enable.status}); set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET or provide AUTH_DEK_KEY for bootstrap: ${JSON.stringify(enableBody)}`,
    );
  }
  const totpUri = enableBody?.totpURI;
  if (typeof totpUri !== "string") {
    throw new Error("two-factor enable did not return totpURI");
  }
  const secret = parseTotpSecretFromUri(totpUri);
  console.log(`::add-mask::${secret}`);
  const code = new TOTP({ secret }).generate();
  const verify = await fetch(`${authBase}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: authBase,
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ code, trustDevice: true }),
  });
  captureCookies(verify, jar);
  if (!verify.ok) {
    throw new Error(`two-factor verify failed (${verify.status}): ${await verify.text()}`);
  }
  if (!(await isTwoFactorEnabled(email))) {
    throw new Error("two-factor verify succeeded but user.two_factor_enabled is still false");
  }
  await assertTotpAcceptedByAuth(authBase, email, password, secret);
  console.log("shop-admin staff silver TOTP enrolled");
  persistTotpSecretOnGithub(secret);
}

async function markEmailVerified(email) {
  const client = new pg.Client(buildPgConnectionConfig(process.env.DATABASE_URL_OWNER ?? ""));
  await client.connect();
  try {
    await client.query('update public."user" set email_verified = true where lower(email) = $1', [
      email.toLowerCase(),
    ]);
  } finally {
    await client.end();
  }
}

async function ensureUser(authBase, email, password) {
  const client = new pg.Client(buildPgConnectionConfig(process.env.DATABASE_URL_OWNER ?? ""));
  await client.connect();
  try {
    const existing = await client.query('select id from public."user" where lower(email) = $1', [
      email.toLowerCase(),
    ]);
    if (existing.rowCount) {
      console.log(`shop-admin staff identity already exists (${email})`);
      await markEmailVerified(email);
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
        await markEmailVerified(email);
        return created.rows[0].id;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("staff user was not persisted within 30 seconds");
  } finally {
    await verifyClient.end();
  }
}

function resolveStaffAcceptanceEmail() {
  const explicit = process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL?.trim();
  if (explicit) return explicit;
  const source = process.env.IDENTITY_ACCEPTANCE_EMAIL?.trim();
  if (!source) {
    throw new Error(
      "SHOP_ADMIN_ACCEPTANCE_EMAIL or IDENTITY_ACCEPTANCE_EMAIL is required to derive staff acceptance email",
    );
  }
  return deriveAcceptanceEmail(source, "shop-admin", "");
}

async function main() {
  const email = resolveStaffAcceptanceEmail();
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
  await ensureSilverTotp(authBase, email, password);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
