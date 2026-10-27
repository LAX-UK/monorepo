import type { BuyerAgentAuthorisationView } from "@auction/types";

const LONDON = "Europe/London";
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "12 Nov 2026", in London time so a day picked in the UK reads back the same. */
export function formatLondonDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayFormat.format(date);
}

/** A `YYYY-MM-DD` day as "1 Nov 2026" (read at noon, so the zone never shifts the day). */
export function formatDay(day: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatLondonDay(`${day}T12:00:00Z`) : day;
}

/** "£10,000" for whole pounds, "£2,500.50" otherwise. */
export function formatPounds(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** The state an authorisation is in, from the bidder's point of view. */
export type AuthorisationState = "active" | "scheduled" | "expired" | "revoked";

export function authorisationState(a: BuyerAgentAuthorisationView): AuthorisationState {
  if (a.status === "revoked") return "revoked";
  if (a.expired) return "expired";
  if (a.scheduled) return "scheduled";
  return "active";
}

/** Tone names shared by the client and staff badges; each surface maps them to its own kit. */
export type AuthorisationTone = "success" | "info" | "neutral";

const STATE_PRESENTATION: Record<AuthorisationState, { label: string; tone: AuthorisationTone }> = {
  active: { label: "Can bid", tone: "success" },
  scheduled: { label: "Starts later", tone: "info" },
  expired: { label: "Ended", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
};

export function authorisationStatePresentation(a: BuyerAgentAuthorisationView) {
  return STATE_PRESENTATION[authorisationState(a)];
}

export type AuthorisationSummary = {
  /** "All sales" or the sale's title. */
  scope: string;
  /** "Up to £10,000" or "No limit". */
  limit: string;
  /** "From 1 Nov 2026 to 30 Nov 2026", "Until 30 Nov 2026", "From 1 Nov 2026" or "No end date". */
  window: string;
};

export function summariseAuthorisation(a: BuyerAgentAuthorisationView): AuthorisationSummary {
  const from = a.scheduled ? formatLondonDay(a.validFrom) : null;
  const until = a.validUntil ? formatLondonDay(a.validUntil) : null;
  const window =
    from && until
      ? `From ${from} to ${until}`
      : until
        ? `Until ${until}`
        : from
          ? `From ${from}`
          : "No end date";
  return {
    scope: a.saleId ? (a.saleTitle ?? "One sale") : "All sales",
    limit: a.bidLimit ? `Up to ${formatPounds(a.bidLimit)}` : "No limit",
    window,
  };
}

/** What revoking means, for the confirmation: who loses what, and that placed bids stand. */
export function revokeConsequence(a: BuyerAgentAuthorisationView, entityName: string): string {
  const where = a.saleId ? `in ${a.saleTitle ?? "that sale"}` : "in any sale";
  return `${a.userName} will no longer be able to bid for ${entityName} ${where}. Bids already placed stand.`;
}

/** Active (including scheduled) authorisations for one member, most specific first. */
export function liveAuthorisationsFor(
  authorisations: readonly BuyerAgentAuthorisationView[],
  userId: string,
): BuyerAgentAuthorisationView[] {
  return authorisations
    .filter((a) => a.userId === userId && a.status === "active" && !a.expired)
    .sort((a, b) => Number(b.saleId != null) - Number(a.saleId != null));
}
