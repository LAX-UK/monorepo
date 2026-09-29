#!/usr/bin/env node
/**
 * Warm up test Bid, Shop, and Identity readiness endpoints before a demo.
 */
const targets = [
  "https://test.lax.bid/api/health/ready",
  "https://test-shop.lax.bid/health/ready",
  "https://test-auth.lax.bid/health/ready",
  "https://test-api.lax.bid/health/ready",
];

async function warm(url) {
  const started = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  const ms = Date.now() - started;
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status} in ${ms}ms: ${body.slice(0, 200)}`);
  }
  console.log(`warm-up ok ${url} (${ms}ms)`);
}

async function main() {
  for (const url of targets) {
    await warm(url);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
