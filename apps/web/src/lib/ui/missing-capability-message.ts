/** User-facing description for API `missing_capability` errors. */
export function missingCapabilityNotifyMessage(
  fallback: string,
  meta?: Record<string, unknown>,
): string {
  if (!meta || meta.code !== "missing_capability") return fallback;
  const required = Array.isArray(meta.required) ? meta.required.join(", ") : "catalogue access";
  const actor = meta.actor as { role?: string; staffRoles?: unknown } | undefined;
  const held = Array.isArray(actor?.staffRoles)
    ? actor.staffRoles.filter((r): r is string => typeof r === "string")
    : null;
  const staffRoles = held === null ? "unknown" : held.length === 0 ? "none" : held.join(", ");
  const noun = held && held.length > 1 ? "staff roles" : "staff role";
  return `${fallback} (required: ${required}; your ${noun}: ${staffRoles}). Try signing out and back in.`;
}
