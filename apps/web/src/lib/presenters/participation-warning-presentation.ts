import type { StatusPresentation } from "@/lib/presenters/status-presentation";

export type LotParticipationWarningKind = "antiSnipeExtended" | "onsiteNoWebBidding";

/** Bid-flow warnings (anti-snipe, onsite gating) — not API lifecycle status. */
export function lotParticipationWarningPresentation(
  kind: LotParticipationWarningKind,
  params?: { extendedSeconds?: number },
): StatusPresentation {
  switch (kind) {
    case "antiSnipeExtended": {
      const seconds = Math.max(1, Math.round(params?.extendedSeconds ?? 0));
      return { label: `Extended +${seconds}s`, variant: "warning" };
    }
    case "onsiteNoWebBidding":
      return { label: "In-Person Saleroom Event", variant: "warning" };
  }
}

/** Callout shell tokens aligned with StatusBadge `warning` variant. */
export const participationWarningCalloutClassName =
  "rounded-2xl border border-primary-container/40 bg-primary-fixed/10 p-5";
export const participationWarningCalloutTitleClassName =
  "font-body text-sm font-semibold text-on-primary-fixed";
export const participationWarningCalloutBodyClassName =
  "mt-1 font-body text-xs leading-relaxed text-on-primary-fixed/80";
