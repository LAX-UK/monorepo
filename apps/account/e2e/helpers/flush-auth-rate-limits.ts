import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Clears the sign-in service's request allowance on the throwaway test stack, so a journey that
 * signs in many times does not trip the per-address limit.
 */
export function flushAuthRateLimits(): void {
  const result = spawnSync("node", [path.join(repoRoot, "scripts/ci/flush-auth-rate-limits.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error("failed to flush auth rate-limit keys before sign-in");
}
