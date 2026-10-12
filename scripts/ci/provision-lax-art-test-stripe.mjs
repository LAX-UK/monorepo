#!/usr/bin/env node
/**
 * Provision Shop + lax.art Stripe webhooks on the dedicated LAX Art **test** account
 * (interim "London Art Test" org account), not the Bid sandbox.
 *
 * Prerequisites:
 * - Test-mode secret key for the LAX Art account in LAX_ART_TEST_STRIPE_SECRET_KEY
 *   (restricted key with Checkout, Refunds, Connect, Webhook Endpoints write).
 * - Optional: STRIPE_SHOP_PUBLISHABLE_KEY (pk_test_…) for shop-api embedded Connect.
 *
 * Usage:
 *   LAX_ART_TEST_STRIPE_SECRET_KEY=sk_test_… node scripts/ci/provision-lax-art-test-stripe.mjs
 *   UPDATE_GITHUB_SECRETS=1 LAX_ART_TEST_STRIPE_SECRET_KEY=… STRIPE_SHOP_PUBLISHABLE_KEY=pk_test_… \
 *     node scripts/ci/provision-lax-art-test-stripe.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SHOP_HOST = process.env.SHOP_STRIPE_WEBHOOK_HOST ?? "https://test-shop.lax.bid";
const PAYMENT_URL = `${SHOP_HOST}/webhooks/stripe`;
const CONNECT_URL = `${SHOP_HOST}/webhooks/stripe/connect`;

const PAYMENT_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
];

const CONNECT_EVENTS = ["account.updated"];

/** Bid test sandbox key from Stripe CLI default profile (same platform, other sandbox). */
const BID_SANDBOX_TEST_KEY_PREFIX = "sk_test_51TU4J13Bcac3pHk5";

function loadSecretKey() {
  const fromEnv = process.env.LAX_ART_TEST_STRIPE_SECRET_KEY?.trim();
  if (fromEnv) return fromEnv;
  const envFile = process.env.LAX_ART_TEST_STRIPE_ENV_FILE?.trim();
  if (envFile) {
    const text = readFileSync(envFile, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*LAX_ART_TEST_STRIPE_SECRET_KEY\s*=\s*(.+?)\s*$/);
      if (m?.[1]) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

const validateOnly = process.argv.includes("--validate-only");
const secretKey = loadSecretKey();
if (!secretKey?.startsWith("sk_test_")) {
  console.error(
    "Set LAX_ART_TEST_STRIPE_SECRET_KEY (or LAX_ART_TEST_STRIPE_ENV_FILE pointing at .local/london-art-test-stripe.env).",
  );
  console.error(
    "Create the restricted key in Dashboard while **London Art Test** sandbox is selected (not LAX LTD sandbox).",
  );
  process.exit(1);
}
if (secretKey.startsWith(BID_SANDBOX_TEST_KEY_PREFIX)) {
  console.error(
    "This sk_test matches the Bid sandbox (London Auction Xchange LTD sandbox). " +
      "Switch to **London Art Test** in Switch to sandbox, then create a new restricted key.",
  );
  process.exit(1);
}

async function stripeGet(path, searchParams) {
  const url = new URL(`https://api.stripe.com/v1${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Stripe GET ${path} failed (${res.status})`);
  }
  return body;
}

function encodeForm(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, item);
    } else {
      params.append(key, value);
    }
  }
  return params.toString();
}

async function stripePost(path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(form),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Stripe POST ${path} failed (${res.status})`);
  }
  return body;
}

function findEndpoint(endpoints, url) {
  return endpoints.find((e) => e.url === url && !e.deleted);
}

async function ensureWebhook(url, enabledEvents) {
  const listed = await stripeGet("/webhook_endpoints", { limit: 100 });
  const existing = findEndpoint(listed.data ?? [], url);
  if (existing) {
    console.log(`Webhook already exists: ${url} (${existing.id})`);
    return existing;
  }
  const created = await stripePost("/webhook_endpoints", { url, enabled_events: enabledEvents });
  console.log(`Created webhook: ${url} (${created.id})`);
  return created;
}

function setGhSecret(name, value) {
  if (!value) return;
  const result = spawnSync(
    "gh",
    ["secret", "set", name, "--env", "test", "--repo", "LAX-UK/monorepo"],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `gh secret set ${name} failed`);
  }
  console.log(`GitHub test secret updated: ${name}`);
}

async function main() {
  const account = await stripeGet("/account");
  const display =
    account.settings?.dashboard?.display_name ?? account.business_profile?.name ?? account.id;
  console.log(`Stripe platform account: ${account.id} (dashboard: ${display})`);
  console.log(
    "Sandbox keys can share one platform account id; this script rejects only the known Bid sandbox sk_test prefix.",
  );

  if (validateOnly) {
    const listed = await stripeGet("/webhook_endpoints", { limit: 100 });
    const endpoints = listed.data ?? [];
    console.log(`Webhook endpoints visible with this key: ${endpoints.length}`);
    for (const url of [PAYMENT_URL, CONNECT_URL]) {
      const hit = findEndpoint(endpoints, url);
      console.log(hit ? `OK  ${url} (${hit.id})` : `MISS ${url}`);
    }
    return;
  }

  const payment = await ensureWebhook(PAYMENT_URL, PAYMENT_EVENTS);
  const connect = await ensureWebhook(CONNECT_URL, CONNECT_EVENTS);

  console.log("\nStore these in GitHub environment **test** (never commit):");
  console.log("- STRIPE_SHOP_SECRET_KEY  ← same restricted sk_test used for this script");
  console.log("- STRIPE_SHOP_WEBHOOK_SECRET  ← payment endpoint signing secret");
  console.log("- STRIPE_SHOP_CONNECT_WEBHOOK_SECRET  ← Connect endpoint signing secret");
  console.log(
    "- STRIPE_SHOP_PUBLISHABLE_KEY  ← pk_test_… from this account (Developers → API keys)",
  );
  console.log("\nSet GitHub variable: STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art");
  console.log(
    "Re-apply test ephemeral Terraform / App deploy test. Bid STRIPE_* secrets stay unchanged.",
  );

  if (process.env.UPDATE_GITHUB_SECRETS === "1") {
    setGhSecret("STRIPE_SHOP_SECRET_KEY", secretKey);
    setGhSecret("STRIPE_SHOP_WEBHOOK_SECRET", payment.secret);
    setGhSecret("STRIPE_SHOP_CONNECT_WEBHOOK_SECRET", connect.secret);
    const pk = process.env.STRIPE_SHOP_PUBLISHABLE_KEY?.trim();
    if (pk) setGhSecret("STRIPE_SHOP_PUBLISHABLE_KEY", pk);
    spawnSync(
      "gh",
      [
        "variable",
        "set",
        "STRIPE_SHOP_CONNECT_PLATFORM_KEY",
        "--env",
        "test",
        "--repo",
        "LAX-UK/monorepo",
        "--body",
        "lax_art",
      ],
      { encoding: "utf8" },
    );
    console.log("GitHub test variable updated: STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art");
  } else {
    console.log("\n(Run with UPDATE_GITHUB_SECRETS=1 to push secrets via gh CLI.)");
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
