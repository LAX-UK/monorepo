/** Stripe Account.requirements.errors entry — shared across db, API, and UI. */
export type StripeConnectRequirementError = {
  requirement: string;
  code: string;
  reason: string;
};

/** Requirement keys + validation errors from the last Connect sync. */
export type StripeConnectRequirementsView = {
  currentlyDue: string[];
  errors: StripeConnectRequirementError[];
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse Stripe Account.requirements.errors into a stable persisted shape. */
export function normalizeStripeConnectRequirementErrors(
  raw: unknown,
): StripeConnectRequirementError[] {
  if (!Array.isArray(raw)) return [];

  const out: StripeConnectRequirementError[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const requirement = nonEmptyString(record.requirement);
    const code = nonEmptyString(record.code);
    const reason = nonEmptyString(record.reason);
    if (!requirement || !code || !reason) continue;
    out.push({ requirement, code, reason });
  }
  return out;
}

/** Trim and dedupe Stripe requirement keys (e.g. requirements.currently_due). */
export function normalizeStripeConnectRequirementKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const keys = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) keys.add(trimmed);
  }
  return [...keys];
}
