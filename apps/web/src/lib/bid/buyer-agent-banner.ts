import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import type { MyBuyerAgentAuthorisation, OrganisationBiddingLimitsView } from "@auction/types";

/** One authorisation as the banner reads it: where and how much, and what is used. */
export type AuthorisationLineVm = {
  key: string;
  /** "in Modern British & Irish Art up to £20,000 a lot, until 19 Nov". */
  text: string;
  /** "£8,000 of your £25,000 total is used", with the share for the bar; `null` without a total. */
  usage: { text: string; percent: number } | null;
};

export type BuyerAgentBannerVm =
  | { kind: "authorised"; organisation: string; lines: AuthorisationLineVm[] }
  | { kind: "not-authorised"; organisation: string };

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
});

function percentUsed(exposure: string, limit: string): number {
  const total = Number.parseFloat(limit);
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((Number.parseFloat(exposure) / total) * 100)));
}

function lineFor(
  authorisation: MyBuyerAgentAuthorisation,
  limits: OrganisationBiddingLimitsView | null,
): AuthorisationLineVm {
  const saleId = authorisation.sale?.id ?? null;
  const where = authorisation.sale ? `in ${authorisation.sale.title}` : "in every sale";
  const limit = authorisation.bidLimit
    ? ` up to ${formatPounds(authorisation.bidLimit)} a lot`
    : " with no limit a lot";
  const until = authorisation.validUntil
    ? `, until ${DAY_MONTH.format(new Date(authorisation.validUntil))}`
    : "";
  const usage = limits?.authorisations.find((entry) => entry.saleId === saleId)?.total ?? null;
  return {
    key: saleId ?? "all",
    text: `${where}${limit}${until}`,
    usage:
      usage?.limit != null
        ? {
            text: `${formatPounds(usage.exposure)} of your ${formatPounds(usage.limit)} total is used.`,
            percent: percentUsed(usage.exposure, usage.limit),
          }
        : null,
  };
}

/**
 * What a buyer agent is told above their bids: where they may bid for the organisation, up to
 * how much and until when, and how much of their total is in use. With no authorisation in force
 * they are told who can give one, so the limit is never found by being refused.
 */
export function buildBuyerAgentBanner(input: {
  organisation: string;
  authorisations: readonly MyBuyerAgentAuthorisation[];
  limits: OrganisationBiddingLimitsView | null;
}): BuyerAgentBannerVm {
  if (input.authorisations.length === 0) {
    return { kind: "not-authorised", organisation: input.organisation };
  }
  return {
    kind: "authorised",
    organisation: input.organisation,
    lines: input.authorisations.map((authorisation) => lineFor(authorisation, input.limits)),
  };
}
