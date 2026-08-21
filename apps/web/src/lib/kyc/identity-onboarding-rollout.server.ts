import "server-only";

function parseEnabled(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

/**
 * Ships enabled in local/test environments and dark in production until the
 * production smoke test and cohort rollout are complete.
 */
export function isIdentityOnboardingEnabled(): boolean {
  const configured = parseEnabled(process.env.KYC_ONBOARDING_ENABLED);
  if (configured != null) return configured;
  return process.env.NODE_ENV !== "production";
}
