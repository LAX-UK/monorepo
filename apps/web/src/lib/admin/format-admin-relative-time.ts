/** Compact relative timestamp for admin triage labels (locale-neutral numbers). */
export function formatAdminRelativeTimeLabel(
  value: Date | string | null | undefined,
  now = new Date(),
): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toISOString().slice(0, 10);
}

export type AdminIssueAgeUrgency = "none" | "attention" | "stale";

export function adminIssueAgeUrgency(
  value: Date | string | null | undefined,
  now = new Date(),
): AdminIssueAgeUrgency {
  if (value == null) return "none";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "none";
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days >= 14) return "stale";
  if (days >= 7) return "attention";
  return "none";
}
