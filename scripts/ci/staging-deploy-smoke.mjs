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
    pinShop: pin("shop"),
    pinAuth: pin("auth"),
  };
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
      (!expectedRelease || release === expectedRelease)
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
