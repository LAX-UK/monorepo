import {
  formatLondonDay,
  formatPounds,
  liveAuthorisationsFor,
  summariseAuthorisation,
} from "@/lib/buyer-agents/authorisation-presenter";
import type {
  AuthorisableBuyerAgent,
  BiddingLimitUsage,
  BuyerAgentAuthorisationOverview,
  BuyerAgentAuthorisationView,
  OrganisationBiddingLimitsView,
} from "@auction/types";
import type { StatusBadgeTone } from "@auction/ui/lax";

/**
 * "Who can bid", read from the authorisations and the limits: the organisation's own limit with
 * what is committed under it, each buyer agent's authorisations with their per-lot and total
 * limits and how much of the total is in use, and the agents nobody has authorised yet.
 */

/** A limit with what is in use: "£8,000 of £25,000", or just what is committed with no limit. */
export type UsageView = {
  /** "£8,000 of £25,000" or "£8,000 committed". */
  text: string;
  /** "£17,000 left"; `null` with no limit. */
  left: string | null;
  /** 0–100 for the bar; `null` with no limit (no bar). */
  percent: number | null;
  /** Nothing is in use: the words are quiet, never a lone "£0". */
  idle: boolean;
};

export type OrganisationLimitView = {
  /** "£250,000", or `null` for no organisation limit. */
  limit: string | null;
  /** The limit in pounds, for the change dialog. */
  limitPounds: number | null;
  usage: UsageView;
  canManage: boolean;
};

export type AuthorisationRowView = {
  id: string;
  agent: AuthorisableBuyerAgent;
  /** "Tom Whitfield · Autumn online: Works on Paper". */
  title: string;
  /** "Until 30 Nov 2026", "£10,000 a lot". */
  facts: string[];
  usage: UsageView | null;
  badge: { label: string; tone: StatusBadgeTone };
  authorisation: BuyerAgentAuthorisationView;
};

export type WhoCanBidView = {
  organisation: OrganisationLimitView | null;
  rows: AuthorisationRowView[];
  /** Buyer agents with nothing in force: they can't bid for the organisation yet. */
  unauthorised: AuthorisableBuyerAgent[];
  canManage: boolean;
};

function pounds(value: string | null): number | null {
  if (value == null) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function usageView(usage: BiddingLimitUsage): UsageView {
  const limit = pounds(usage.limit);
  const exposure = pounds(usage.exposure) ?? 0;
  if (limit == null || limit <= 0) {
    return exposure > 0
      ? { text: `${formatPounds(exposure)} committed`, left: null, percent: null, idle: false }
      : { text: "Nothing committed yet", left: null, percent: null, idle: true };
  }
  const available = pounds(usage.available) ?? Math.max(limit - exposure, 0);
  return {
    text: `${formatPounds(exposure)} of ${formatPounds(limit)}`,
    left: `${formatPounds(available)} left`,
    percent: Math.min(100, Math.round((exposure / limit) * 100)),
    idle: exposure === 0,
  };
}

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });

function badgeFor(a: BuyerAgentAuthorisationView, now: Date): AuthorisationRowView["badge"] {
  if (a.scheduled) return { label: `Starts ${formatLondonDay(a.validFrom)}`, tone: "neutral" };
  if (a.validUntil && LONDON_DAY.format(new Date(a.validUntil)) === LONDON_DAY.format(now)) {
    return { label: "Ends today", tone: "warning" };
  }
  return { label: "Can bid", tone: "success" };
}

export function whoCanBidView(input: {
  overview: BuyerAgentAuthorisationOverview;
  limits: OrganisationBiddingLimitsView | null;
  now: Date;
}): WhoCanBidView {
  const { overview, limits, now } = input;
  const totals = new Map(limits?.authorisations.map((a) => [a.authorisationId, a.total]) ?? []);
  const rows: AuthorisationRowView[] = [];
  const unauthorised: AuthorisableBuyerAgent[] = [];
  for (const agent of overview.buyerAgents) {
    const live = liveAuthorisationsFor(overview.authorisations, agent.userId);
    if (live.length === 0) unauthorised.push(agent);
    for (const a of live) {
      const summary = summariseAuthorisation(a);
      const total = totals.get(a.id);
      const usage = total ? usageView(total) : null;
      rows.push({
        id: a.id,
        agent,
        title: `${agent.name} · ${summary.scope}`,
        facts: [
          summary.window,
          a.bidLimit ? `${formatPounds(a.bidLimit)} a lot` : "No limit a lot",
          a.totalLimit ? `${formatPounds(a.totalLimit)} in total` : "No total limit",
          ...(a.totalLimit && usage?.left ? [usage.left] : []),
        ],
        // The bar only means something against a total.
        usage: a.totalLimit ? usage : null,
        badge: badgeFor(a, now),
        authorisation: a,
      });
    }
  }
  const org = limits?.organisation ?? null;
  return {
    organisation: org
      ? {
          limit: org.limit ? formatPounds(org.limit) : null,
          limitPounds: pounds(org.limit),
          usage: usageView(org),
          canManage: limits?.canManage ?? false,
        }
      : null,
    rows,
    unauthorised,
    canManage: overview.canManage,
  };
}
