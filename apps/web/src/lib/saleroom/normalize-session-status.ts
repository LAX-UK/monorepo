import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

const SESSION_STATUSES = new Set<PublicSaleroomSessionStatus["status"]>([
  "none",
  "pending",
  "live",
  "paused",
  "ended",
]);

export function normalizeSessionStatus(
  raw: string | null | undefined,
): PublicSaleroomSessionStatus["status"] {
  const normalized = (raw ?? "none").toLowerCase();
  if (normalized === "active") return "live";
  return SESSION_STATUSES.has(normalized as PublicSaleroomSessionStatus["status"])
    ? (normalized as PublicSaleroomSessionStatus["status"])
    : "none";
}
