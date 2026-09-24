import "server-only";

import { bffConfig } from "./config.server";

export const IDENTITY_HEALTH_PROBE_TIMEOUT_MS = 3_000;

export type IdentityDependencyStatus = "ok" | "degraded";

export async function probeIdentityDependency(): Promise<IdentityDependencyStatus> {
  try {
    const { internalIssuer } = bffConfig();
    const response = await fetch(`${internalIssuer}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(IDENTITY_HEALTH_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return "degraded";
    const body = (await response.json()) as { status?: unknown };
    return body.status === "ok" ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}
