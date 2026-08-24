import "server-only";

function parseEnabled(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

/**
 * Enabled by default outside production so behavior can be verified before the
 * production cohort is explicitly switched on.
 */
export function areMarketingPromptsEnabled(): boolean {
  const configured = parseEnabled(process.env.MARKETING_PROMPTS_ENABLED);
  if (configured != null) return configured;
  return process.env.NODE_ENV !== "production";
}
