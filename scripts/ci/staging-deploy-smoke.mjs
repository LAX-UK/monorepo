#!/usr/bin/env node
/**
 * Fast post-deploy smoke for test (readiness + conditional auth/shop probes).
 */
const DEFAULT_ATTEMPTS = 12;
const DEFAULT_INTERVAL_MS = 5000;

export function smokeProbes({
  smokeAuth,
  smokeShop,
  pinApi = true,
  pinWeb = true,
  pinShop = true,
  pinAuth = true,
}) {
  return {
    readinessApi: pinApi,
    readinessWeb: pinWeb,
    readinessAuth: pinAuth && smokeAuth,
    readinessShop: pinShop && smokeShop,
    authDiscovery: smokeAuth,
    shopAdminOidc: smokeShop,
    shopStripeWebhook: smokeShop,
  };
}

export function pinsForTargetSha(tagMap, targetSha) {
  const pin = (component) => tagMap?.[component] === targetSha;
  return {
    pinApi: pin("api"),
    pinWeb: pin("web"),
    pinShop: pin("shop") || pin("shop-api") || pin("shop-identity") || pin("shop-admin"),
    pinAuth: pin("auth"),
  };
}

export function releaseMatchesExpected(body, expectedRelease, url) {
  if (!expectedRelease) return true;
  const top = String(body?.release ?? body?.version ?? "").trim();
  if (top === expectedRelease) return true;
  if (url.includes("test-shop.lax.bid") || url.includes("test-shop-admin.lax.bid")) {
    const apiRelease = body?.dependencies?.shopApi?.release;
    if (apiRelease === expectedRelease) return true;
  }
  return false;
}

async function fetchJson(url, init, fetchImpl = fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), ...init });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: response.ok, status: response.status, body };
}

async function waitForReady(url, expectedRelease, fetchImpl) {
  for (let attempt = 1; attempt <= DEFAULT_ATTEMPTS; attempt++) {
    const result = await fetchJson(url, {}, fetchImpl);
    const release = String(result.body?.release ?? result.body?.version ?? "").trim();
    if (
      result.ok &&
      result.body?.status === "ok" &&
      releaseMatchesExpected(result.body, expectedRelease, url)
    ) {
      return;
    }
    if (attempt === DEFAULT_ATTEMPTS) {
      throw new Error(
        `${url} not ready (status=${result.status}, release=${release || "missing"})`,
      );
    }
    await new Promise((r) => setTimeout(r, DEFAULT_INTERVAL_MS));
  }
}

export async function runStagingDeploySmoke(env, fetchImpl = fetch) {
  const sha = env.TARGET_SHA ?? env.GITHUB_SHA;
  const tagMap = env.TAG_MAP ? JSON.parse(env.TAG_MAP) : {};
  const pins = pinsForTargetSha(tagMap, sha);
  const probes = smokeProbes({
    smokeAuth: env.SMOKE_AUTH === "true",
    smokeShop: env.SMOKE_SHOP === "true",
    ...pins,
  });

  if (probes.readinessApi) {
    await waitForReady("https://test-api.lax.bid/health/ready", sha, fetchImpl);
  }
  if (probes.readinessWeb) {
    await waitForReady("https://test.lax.bid/api/health/ready", sha, fetchImpl);
  }
  if (probes.readinessShop) {
    await waitForReady("https://test-shop.lax.bid/health/ready", sha, fetchImpl);
  }
  if (probes.readinessAuth) {
    await waitForReady("https://test-auth.lax.bid/health/ready", sha, fetchImpl);
  }

  if (probes.authDiscovery) {
    const discovery = await fetchJson(
      "https://test-auth.lax.bid/.well-known/openid-configuration",
      {},
      fetchImpl,
    );
    if (!discovery.ok || !discovery.body?.issuer) {
      throw new Error("Auth OIDC discovery failed");
    }
    const jwks = await fetchJson(String(discovery.body.jwks_uri), {}, fetchImpl);
    if (!jwks.ok || !Array.isArray(jwks.body?.keys) || jwks.body.keys.length === 0) {
      throw new Error("Auth JWKS fetch failed");
    }
  }

  if (probes.shopAdminOidc) {
    const { spawnSync } = await import("node:child_process");
    const oidc = spawnSync("node", ["scripts/ci/verify-shop-admin-oidc-preflight.mjs"], {
      encoding: "utf8",
      env: process.env,
    });
    if (oidc.status !== 0) {
      throw new Error(oidc.stderr || oidc.stdout || "Shop admin OIDC preflight failed");
    }
  }

  if (probes.shopStripeWebhook) {
    const stripeProbe = await fetchJson(
      "https://test-shop.lax.bid/webhooks/stripe",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      fetchImpl,
    );
    if (stripeProbe.status !== 400) {
      throw new Error(`Shop Stripe webhook route unexpected status ${stripeProbe.status}`);
    }
  }
}

async function main() {
  await runStagingDeploySmoke(process.env);
  process.stdout.write("staging deploy smoke passed\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
