import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Only a sign-in service on this machine is a throwaway stack whose Redis may be cleared. */
function isLocalStack(authBaseUrl: string): boolean {
  try {
    const { hostname } = new URL(authBaseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Clears the test Redis rate-limit keys (`rl:*`) before a staff sign-in on the local CI stack.
 *
 * The sign-in service allows one address 30 requests a minute on its general routes
 * (AUTH_RATE_LIMIT_POLICY.authGeneralMax). Every LAX Admin check signs in from 127.0.0.1, and
 * each sign-in spends several of those (authorize, consent, the code and Shop API token
 * exchanges, sign-out), so two workers opening sessions together can be answered 429 depending
 * only on how fast the run was. Bid and Account's suites clear the keys the same way. This never
 * runs against a deployed environment, and the production limits are unchanged.
 */
export function flushAuthRateLimitsOnLocalStack(authBaseUrl: string): void {
  if (!process.env.REDIS_URL || !isLocalStack(authBaseUrl)) return;
  const result = spawnSync("node", [path.join(repoRoot, "scripts/ci/flush-auth-rate-limits.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error("failed to flush auth rate-limit keys before sign-in");
}
