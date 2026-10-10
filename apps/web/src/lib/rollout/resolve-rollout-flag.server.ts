import "server-only";

import { parseBooleanFlag } from "@/lib/rollout/parse-boolean-flag";

export function resolveRolloutFlag(name: string, fallback: boolean): boolean {
  const configured = parseBooleanFlag(process.env[name]);
  return configured ?? fallback;
}

/**
 * Local dev and non-production deployments (test builds run with
 * `NODE_ENV=production`, so `APP_ENV` decides). Unset `APP_ENV` counts as production.
 */
export function isNonProductionDeployment(): boolean {
  return (
    process.env.NODE_ENV !== "production" || (process.env.APP_ENV ?? "production") !== "production"
  );
}
