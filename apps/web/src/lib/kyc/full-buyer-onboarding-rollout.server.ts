import "server-only";

function parseEnabled(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isFullBuyerOnboardingEnabled(): boolean {
  const configured = parseEnabled(process.env.FULL_BUYER_ONBOARDING_ENABLED);
  if (configured != null) return configured;
  return process.env.NODE_ENV !== "production";
}
