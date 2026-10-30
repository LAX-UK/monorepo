import type { SessionUser } from "@/lib/data/contracts";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import {
  entityRoleCan,
  organisationStatePolicy,
  roleBidsThroughAuthorisation,
} from "@auction/domain";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";

type KycStatus = NonNullable<SessionUser["kycStatus"]>;

export type BiddingStandingRow = {
  id: "identity" | "limit" | "organisation";
  title: string;
  detail: string;
  action: { label: string; href: string } | null;
};

/** What the identity check means for bidding, one row per status. */
const IDENTITY: Record<KycStatus, Omit<BiddingStandingRow, "id">> = {
  approved: {
    title: "Identity verified",
    detail: "You can bid in every sale you register for.",
    action: null,
  },
  pending: {
    title: "We're checking your identity",
    detail: "This usually takes less than a working day. We'll email you when it's done.",
    action: null,
  },
  unverified: {
    title: "Verify your identity",
    detail: "We check who you are once, before your first bid.",
    action: { label: "Verify identity", href: CLIENT_ROUTES.verifyIdentity },
  },
  rejected: {
    title: "We couldn't verify your identity",
    detail: "Try again with a clear photo, or ask client services for help.",
    action: { label: "Try again", href: CLIENT_ROUTES.verifyIdentity },
  },
};

const LIMIT: BiddingStandingRow = {
  id: "limit",
  title: "Bidding limit",
  detail: "Your limit is set when we verify you. Ask us to raise it at any time.",
  action: { label: "Request an increase", href: "/contact?intent=bidding-limit" },
};

/** The organisation the person is acting for, when they are not acting as themselves. */
export type BiddingOrganisation = {
  name: string;
  status: LegalEntityStatus;
  role: LegalEntityMemberRole;
};

/**
 * Where the organisation stands to bid. Its state decides first (the same table as the bid
 * panel); then the person's role: owners and admins bid without a limit, buyer agents within
 * the authorisation they are given, and the other roles do not bid.
 */
function organisationStanding({ name, status, role }: BiddingOrganisation): BiddingStandingRow {
  const state = organisationStatePolicy(status, new Set());
  if (state.bidPanelReasonKey) {
    const reason = organisationBidReasonCopy(state.bidPanelReasonKey, { organisationName: name });
    return {
      id: "organisation",
      title: reason.title,
      detail: reason.line,
      action: reason.contact ? { label: reason.contact.label, href: reason.contact.href } : null,
    };
  }
  if (!entityRoleCan(role, "entity.bid.place")) {
    return {
      id: "organisation",
      title: `You don't bid for ${name}`,
      detail: "Your role here doesn't place bids. An owner or admin can change it.",
      action: null,
    };
  }
  return {
    id: "organisation",
    title: `${name} is approved to bid`,
    detail: roleBidsThroughAuthorisation(role)
      ? "You bid up to the limit an owner or admin sets for you, sale by sale."
      : "There is no limit on bids placed for the organisation.",
    action: null,
  };
}

function personalStanding(kycStatus: SessionUser["kycStatus"]): BiddingStandingRow[] {
  return [{ id: "identity", ...IDENTITY[kycStatus ?? "unverified"] }, LIMIT];
}

/**
 * Bid settings' Bidding section. For yourself: whether you can bid and how to raise your limit.
 * For an organisation: the organisation's standing, plus your own identity check only where it
 * gates your bids (a buyer agent bids in their own name).
 */
export function biddingStanding(
  kycStatus: SessionUser["kycStatus"],
  organisation: BiddingOrganisation | null = null,
): BiddingStandingRow[] {
  if (!organisation) return personalStanding(kycStatus);
  const rows = [organisationStanding(organisation)];
  if (roleBidsThroughAuthorisation(organisation.role)) {
    rows.push({ id: "identity", ...IDENTITY[kycStatus ?? "unverified"] });
  }
  return rows;
}
