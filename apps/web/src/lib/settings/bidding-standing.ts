import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import type { SessionUser } from "@/lib/data/contracts";
import { CLIENT_ROUTES, teamHref } from "@/lib/navigation/client-routes";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import { formatDateInline } from "@/lib/ui/format";
import {
  type EntityActor,
  entityActorCan,
  organisationStatePolicy,
  roleBidsThroughAuthorisation,
  roleNeedsPersonalIdentity,
} from "@auction/domain";
import type { LegalEntityStatus, OrganisationBiddingLimitsView } from "@auction/types";
import type { StatusBadgeTone } from "@auction/ui/lax";

type KycStatus = NonNullable<SessionUser["kycStatus"]>;

/**
 * One line of Bid settings' Bidding card: what it is, where it stands (a badge or a figure), a
 * sentence on what that means, and at most one thing to do about it.
 */
export type BiddingRow = {
  id: "identity" | "limit" | "check" | "who_can_bid" | "authorisation" | "role";
  label: string;
  value:
    | { kind: "badge"; text: string; tone: StatusBadgeTone }
    | { kind: "text"; text: string }
    /** A large figure ("£250,000") with a quiet unit after it ("across open bids"). */
    | { kind: "figure"; text: string; unit: string | null };
  detail: string;
  action: { label: string; href: string; style: "button" | "link" } | null;
};

const IDENTITY: Record<KycStatus, Omit<BiddingRow, "id" | "label">> = {
  approved: {
    value: { kind: "badge", text: "Verified", tone: "success" },
    detail: "You can bid in every sale you register for.",
    action: null,
  },
  pending: {
    value: { kind: "badge", text: "Being checked", tone: "info" },
    detail: "This usually takes less than a working day. We'll email you when it's done.",
    action: null,
  },
  unverified: {
    value: { kind: "badge", text: "Not verified yet", tone: "warning" },
    detail: "We check who you are once, before your first bid.",
    action: { label: "Verify identity", href: CLIENT_ROUTES.verifyIdentity, style: "button" },
  },
  rejected: {
    value: { kind: "badge", text: "Not verified", tone: "danger" },
    detail: "Try again with a clear photo, or ask client services for help.",
    action: { label: "Try again", href: CLIENT_ROUTES.verifyIdentity, style: "button" },
  },
};

function identityRow(kycStatus: SessionUser["kycStatus"], label: string): BiddingRow {
  return { id: "identity", label, ...IDENTITY[kycStatus ?? "unverified"] };
}

const PERSONAL_LIMIT: BiddingRow = {
  id: "limit",
  label: "Bidding limit",
  value: { kind: "text", text: "Set when we verify you" },
  detail: "Ask us before a big sale and we'll look at raising it.",
  action: {
    label: "Request a higher limit",
    href: "/contact?intent=bidding-limit",
    style: "button",
  },
};

/** The organisation the person is acting for, with what Bid settings reads about it. */
export type BiddingOrganisation = {
  name: string;
  status: LegalEntityStatus;
  /** When LAX last changed its state: for an approved organisation, the day it was checked. */
  checkedAt: Date | null;
  actor: EntityActor;
  /** The organisation limit and authorisations; `null` when they can't be read or shown. */
  limits: OrganisationBiddingLimitsView | null;
  /** Owners, admins and authorised buyer agents; `null` when not counted for this role. */
  biddersCount: number | null;
  /** The member's own user id, to find their authorisation. */
  userId: string;
};

function checkRow(org: BiddingOrganisation): BiddingRow {
  const view = organisationStatusView(org.status);
  const state = organisationStatePolicy(org.status, new Set());
  const reason = state.bidPanelReasonKey
    ? organisationBidReasonCopy(state.bidPanelReasonKey, { organisationName: org.name })
    : null;
  return {
    id: "check",
    label: "Organisation check",
    value: { kind: "badge", text: view.label, tone: view.tone },
    detail: reason
      ? reason.line
      : org.checkedAt
        ? `Checked on ${formatDateInline(org.checkedAt)}.`
        : "Checked by our team.",
    action: reason?.contact
      ? { label: reason.contact.label, href: reason.contact.href, style: "button" }
      : null,
  };
}

function limitRow(org: BiddingOrganisation): BiddingRow | null {
  if (!entityActorCan(org.actor, "entity.bid.place")) return null;
  const manage = entityActorCan(org.actor, "entity.bidding_limits.manage");
  const limits = org.limits;
  if (!limits) {
    return {
      id: "limit",
      label: "Bidding limit",
      value: { kind: "text", text: "Not available right now" },
      detail: "We couldn't read the limit. The rest of this page still works; try again soon.",
      action: null,
    };
  }
  const { limit, available } = limits.organisation;
  if (!limit) {
    return {
      id: "limit",
      label: "Bidding limit",
      value: { kind: "text", text: "No organisation limit" },
      detail: manage
        ? `Set one to cap what everyone bidding for ${org.name} can commit, owners included.`
        : `Owners and admins can set one for everyone who bids for ${org.name}.`,
      action: manage ? { label: "Set a limit", href: teamHref("bidding"), style: "button" } : null,
    };
  }
  return {
    id: "limit",
    label: "Bidding limit",
    value: { kind: "figure", text: formatPounds(limit), unit: "across open bids" },
    detail: `${available ? `${formatPounds(available)} left now. ` : ""}It applies to everyone who bids for ${org.name}, owners included.`,
    action: manage ? { label: "Change limit", href: teamHref("bidding"), style: "button" } : null,
  };
}

function whoCanBidRow(org: BiddingOrganisation): BiddingRow | null {
  if (org.biddersCount === null || !entityActorCan(org.actor, "entity.members.manage")) return null;
  return {
    id: "who_can_bid",
    label: "Who can bid",
    value: {
      kind: "text",
      text: org.biddersCount === 1 ? "1 member" : `${org.biddersCount} members`,
    },
    detail: "Owners, admins and buyer agents you authorise.",
    action: { label: "Manage in Members", href: teamHref("members"), style: "link" },
  };
}

function authorisationRow(org: BiddingOrganisation): BiddingRow {
  const mine = org.limits?.authorisations.filter((a) => a.userId === org.userId) ?? [];
  const [first] = mine;
  if (!first) {
    return {
      id: "authorisation",
      label: "Your authorisation",
      value: { kind: "text", text: "Not authorised yet" },
      detail: `An owner or admin authorises you to bid for ${org.name}, with your limits.`,
      action: null,
    };
  }
  const perLot = first.bidLimit ? formatPounds(first.bidLimit) : null;
  const total = first.total.limit ? formatPounds(first.total.limit) : null;
  const left = first.total.available ? formatPounds(first.total.available) : null;
  return {
    id: "authorisation",
    label: "Your authorisation",
    value: perLot
      ? { kind: "figure", text: perLot, unit: "per lot" }
      : { kind: "text", text: "No limit per lot" },
    detail: [
      first.saleTitle ? `For ${first.saleTitle}.` : "For every sale.",
      total ? `${total} in total${left ? `, ${left} left` : ""}.` : "No total limit.",
      "Ask an owner or admin if you need a change.",
    ].join(" "),
    action: null,
  };
}

function roleRow(org: BiddingOrganisation): BiddingRow {
  return {
    id: "role",
    label: "Your bidding",
    value: { kind: "text", text: `You don't bid for ${org.name}` },
    detail: "Owners, admins and buyer agents bid. Ask an owner if your work needs it.",
    action: null,
  };
}

/**
 * Bid settings' Bidding card. For yourself: your identity check and your limit. For an
 * organisation: its check, its limit, who can bid (owners and admins), a buyer agent's own
 * authorisation and identity check, and for a role that doesn't bid, a line that says so. Never
 * an owner's own identity check: it doesn't decide the organisation's bidding.
 */
export function biddingRows(
  kycStatus: SessionUser["kycStatus"],
  org: BiddingOrganisation | null,
): BiddingRow[] {
  if (!org) return [identityRow(kycStatus, "Identity check"), PERSONAL_LIMIT];
  const bids = entityActorCan(org.actor, "entity.bid.place");
  const agent = roleBidsThroughAuthorisation(org.actor.role);
  return [
    checkRow(org),
    bids ? null : roleRow(org),
    limitRow(org),
    whoCanBidRow(org),
    agent ? authorisationRow(org) : null,
    roleNeedsPersonalIdentity(org.actor.role) && bids
      ? identityRow(kycStatus, "Your identity check")
      : null,
  ].filter((row): row is BiddingRow => row !== null);
}
