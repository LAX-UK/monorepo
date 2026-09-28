#!/usr/bin/env node
/**
 * Read the live Identity release SHA from staging auth /health/ready.
 */
import { appendFileSync } from "node:fs";

const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");

async function main() {
  const response = await fetch(`${authBase}/health/ready`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`health/ready failed (${response.status})`);
  }
  const body = await response.json();
  const release = String(body.release ?? body.version ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(release)) {
    throw new Error(`Invalid Identity release SHA: ${release || "(missing)"}`);
  }
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `identity_sha=${release}\n`);
  }
  process.stdout.write(`${release}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
