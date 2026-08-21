import "server-only";

function parseEnabled(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

/** Mirrors the API rollout default so server-rendered bid gates cannot drift. */
export function isStrictBidEligibilityEnabled(): boolean {
  const configured = parseEnabled(process.env.STRICT_BID_ELIGIBILITY_ENABLED);
  if (configured != null) return configured;
  return process.env.NODE_ENV !== "production";
}
