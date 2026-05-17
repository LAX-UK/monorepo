/** User-facing description for API `missing_capability` errors. */
export function missingCapabilityNotifyMessage(
  fallback: string,
  meta?: Record<string, unknown>,
): string {
  if (!meta || meta.code !== "missing_capability") return fallback;
  const required = Array.isArray(meta.required) ? meta.required.join(", ") : "catalogue access";
  const actor = meta.actor as { role?: string; staffRole?: string | null } | undefined;
  const staffRole =
    actor && typeof actor.staffRole === "string"
      ? actor.staffRole
      : actor?.staffRole === null
        ? "none"
        : "unknown";
  return `${fallback} (required: ${required}; your staff role: ${staffRole}). Try signing out and back in.`;
}
