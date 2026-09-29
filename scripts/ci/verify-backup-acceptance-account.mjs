#!/usr/bin/env node
/**
 * Confirms the long-lived IDENTITY_ACCEPTANCE backup account works on Bid BFF and Shop OIDC.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(label, script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? "unknown"}`);
  }
  console.log(`${label}: ok`);
}

async function main() {
  const email = process.env.IDENTITY_ACCEPTANCE_EMAIL ?? process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.IDENTITY_ACCEPTANCE_PASSWORD ?? process.env.SHOP_OIDC_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("IDENTITY_ACCEPTANCE_EMAIL and IDENTITY_ACCEPTANCE_PASSWORD are required");
  }

  process.env.BID_BFF_TEST_EMAIL = email;
  process.env.BID_BFF_TEST_PASSWORD = password;
  process.env.SHOP_OIDC_TEST_EMAIL = email;
  process.env.SHOP_OIDC_TEST_PASSWORD = password;
  process.env.AUTH_BASE_URL = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";
  process.env.WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://test.lax.bid";
  process.env.API_BASE_URL = process.env.API_BASE_URL ?? "https://test-api.lax.bid";
  process.env.SHOP_IDENTITY_BASE_URL =
    process.env.SHOP_IDENTITY_BASE_URL ?? "https://test-shop.lax.bid";

  run("verify-bid-web-bff-roundtrip", join(root, "scripts/ci/verify-bid-web-bff-roundtrip.mjs"));
  run("verify-shop-oidc-roundtrip", join(root, "scripts/ci/verify-shop-oidc-roundtrip.mjs"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
