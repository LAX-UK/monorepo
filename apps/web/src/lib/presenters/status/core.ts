/** Matches `StatusBadge` `variant` prop in `@auction/ui`. */
export type StatusBadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/** @deprecated Use `StatusBadgeVariant`. */
export type AdminStatusBadgeVariant = StatusBadgeVariant;

/** Accent + typography for countdown text paired with LiveBadge / live StatusBadge. */
export const liveStatusCountdownClassName =
  "font-label text-[length:var(--text-label-1)] tabular-nums font-medium normal-case text-live-red";

/** Urgency tier for live countdown digits (catalog + onsite). */
export type LiveCountdownUrgency = "normal" | "soon" | "imminent" | "live";

/** Text color for countdown by urgency — `live` is always live-red (during event). */
export function liveUrgencyTextClass(urgency: LiveCountdownUrgency): string {
  switch (urgency) {
    case "live":
    case "imminent":
    case "soon":
      return "text-live-red";
    default:
      return "text-on-surface";
  }
}

/** Pulse class for critical countdown segments (respects motion-reduce via caller). */
export const liveUrgencyPulseClass = "live-dot-pulse";

export type StatusPresentation = {
  label: string;
  variant: StatusBadgeVariant;
  dot?: boolean;
};

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
  | "onsiteEvent";

export type StatusDomain = AdminStatusDomain;
