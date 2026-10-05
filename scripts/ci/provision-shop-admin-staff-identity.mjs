#!/usr/bin/env node
/**
 * Idempotent staff acceptance identity on test auth (email/password + silver TOTP).
 *
 * Required: DATABASE_URL_OWNER, SHOP_ADMIN_ACCEPTANCE_PASSWORD, and either
 * SHOP_ADMIN_ACCEPTANCE_EMAIL or IDENTITY_ACCEPTANCE_EMAIL (derive).
 * After first enrolment, set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET on the GitHub test env
 * (script attempts `gh secret set` when GITHUB_TOKEN can write environment secrets).
 */
import { spawnSync } from "node:child_process";
import { TOTP } from "otpauth";
import pg from "pg";
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

async function isTwoFactorEnabled(email) {
  const client = new pg.Client(buildPgConnectionConfig(process.env.DATABASE_URL_OWNER ?? ""));
  await client.connect();
  try {
    const result = await client.query(
      'select two_factor_enabled from public."user" where lower(email) = $1',
      [email.toLowerCase()],
    );
    return Boolean(result.rows[0]?.two_factor_enabled);
  } finally {
    await client.end();
  }
}

async function ensureSilverTotp(authBase, email, password) {
  if (await isTwoFactorEnabled(email)) {
    console.log("shop-admin staff TOTP already enabled");
    return;
  }

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
  if (!signIn.ok) {
    throw new Error(`staff sign-in failed (${signIn.status}): ${await signIn.text()}`);
  }

  const enable = await fetch(`${authBase}/api/auth/two-factor/enable`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: authBase,
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ password }),
  });
  captureCookies(enable, jar);
  const enableBody = await enable.json().catch(() => ({}));
  if (!enable.ok) {
    if (await isTwoFactorEnabled(email)) {
      console.log("shop-admin staff TOTP already enabled (enable returned error)");
      return;
    }
    const configured = process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
    if (configured) {
      console.log(
        "::warning::two-factor enable failed but SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET is set; assuming manual enrolment",
      );
      return;
    }
    throw new Error(`two-factor enable failed (${enable.status}): ${JSON.stringify(enableBody)}`);
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
  console.log("shop-admin staff silver TOTP enrolled");

  const configured = process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
  if (configured && configured !== secret) {
    console.log(
      "::warning::SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET does not match newly enrolled secret; update the GitHub test secret",
    );
  }
  if (!configured && process.env.GITHUB_TOKEN?.trim()) {
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
  } else if (!configured) {
    console.log(
      "::warning::Set SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET on the GitHub test environment (enrolment secret was masked above)",
    );
  }
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
