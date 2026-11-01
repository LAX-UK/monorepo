import { COUNTDOWN_TONE_TEXT_CLASS, type CountdownTone } from "@/lib/presenters/countdown-tone";

/** Matches `StatusBadge` `variant` prop in `@auction/ui`. */
export type StatusBadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/** @deprecated Use `StatusBadgeVariant`. */
export type AdminStatusBadgeVariant = StatusBadgeVariant;

/** Typography for the countdown beside a live status badge: calm ink, tabular digits. */
export const liveStatusCountdownClassName = `font-label text-xs tabular-nums font-medium ${COUNTDOWN_TONE_TEXT_CLASS.calm}`;

/** Urgency tier for live countdown digits (catalog + onsite). */
export type LiveCountdownUrgency = "normal" | "soon" | "imminent" | "live";

/**
 * Urgency onto the countdown tone table. `live` (a lot on the block, a session in progress) is
 * a state, shown by the status badge; its digits stay calm.
 */
const TONE_BY_URGENCY: Readonly<Record<LiveCountdownUrgency, CountdownTone>> = {
  normal: "calm",
  live: "calm",
  soon: "soon",
  imminent: "urgent",
};

/** Text colour for countdown digits by urgency. */
export function liveUrgencyTextClass(urgency: LiveCountdownUrgency): string {
  return COUNTDOWN_TONE_TEXT_CLASS[TONE_BY_URGENCY[urgency]];
}

/** Pulse class for critical countdown segments (respects motion-reduce via caller). */
export const liveUrgencyPulseClass = "live-dot-pulse";

export type StatusPresentation = {
  label: string;
  variant: StatusBadgeVariant;
  dot?: boolean;
};

export function badgeVariantFromRegistry<T extends string>(
  registry: Partial<Record<T, StatusBadgeVariant>>,
  status: T | string,
  fallback: StatusBadgeVariant = "neutral",
): StatusBadgeVariant {
  return registry[status as T] ?? fallback;
}

export function labelFromRegistry<T extends string>(
  registry: Partial<Record<T, string>>,
  status: T | string,
  fallback: (status: string) => string = (value) => value.replaceAll("_", " "),
): string {
  return registry[status as T] ?? fallback(String(status));
}

export type LotStatusContext = {
  /** When set, `ended` resolves to Sold vs Unsold; when omitted, falls back to Ended. */
  winnerId?: string | null | undefined;
  /** List-row sold flag when buyer id is omitted from public summaries. */
  hasWinner?: boolean;
};

export type StatusPresentationContext = {
  lot?: LotStatusContext;
};

export type AdminStatusDomain =
  | "sale"
  | "lot"
  | "artist"
  | "submission"
  | "payment"
  | "payout"
  | "amlMatch"
  | "amlDecision"
  | "amlMonitor"
  | "amlHold"
  | "sofCase"
  | "invitation"
  | "inviteLifecycle"
  | "user"
  | "emailOutbox"
  | "suppression"
  | "registration"
  | "fulfilment"
  | "conditionReport"
  | "saleroomSession"
  | "kyc"
  | "legalEntity"
  | "dispute"
  | "category"
  | "venue"
  | "onsiteEvent"
  | "consignmentThread";

export type StatusDomain = AdminStatusDomain;
