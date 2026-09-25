#!/usr/bin/env node
/**
 * Live contract: Bid web readiness stays green when Identity is merely degraded.
 */
const webOrigin = (process.env.WEB_ORIGIN ?? "https://test.lax.bid").replace(/\/+$/, "");

const response = await fetch(`${webOrigin}/api/health/ready`, {
  signal: AbortSignal.timeout(15_000),
});
const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`Bid /api/health/ready returned ${response.status}`, body);
  process.exit(1);
}
if (body?.status !== "ok") {
  console.error("Bid /api/health/ready must report status ok when Redis is healthy:", body);
  process.exit(1);
}
const identityStatus = body?.dependencies?.identity?.status;
if (identityStatus !== "ok" && identityStatus !== "degraded") {
  console.error(
    "Bid /api/health/ready must report dependencies.identity.status as ok or degraded:",
    body,
  );
  process.exit(1);
}

console.log(`verify-bid-web-health-ready: ok (identity=${identityStatus})`);
