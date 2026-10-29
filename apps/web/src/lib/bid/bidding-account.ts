import {
  type OrganisationBidReasonKey,
  entityCapabilitiesOf,
  entityRoleCan,
  organisationStatePolicy,
} from "@auction/domain";
import type { BidAuthorityView, LegalEntitySummary } from "@auction/types";

/** Why this person cannot bid for the organisation: their membership, whatever its state. */
export type MemberBidRefusal = "role_cannot_bid" | "authorisation_required" | "not_member";

/**
 * Why the active organisation account cannot be used to bid here: the person's membership, or
 * the organisation's own state (documents being checked, paused), which the state policy names.
 */
export type BiddingAccountRefusal = MemberBidRefusal | "organisation_state";

/**
 * Who a bid on this lot is for, as the bid panel shows it. `personal` bids go in the person's
 * own name; an organisation account is either allowed (a buyer agent's limit may apply) or not.
 */
export type BiddingAccount =
  | {
      kind: "personal";
      /** The person also belongs to an organisation, so naming the account avoids slips. */
      hasOrganisations: boolean;
    }
  | {
      kind: "organisation";
      name: string;
      allowed: true;
      /** A buyer agent's limit for this sale, in pounds; `null` when there is none. */
      bidLimit: number | null;
    }
  | {
      kind: "organisation";
      name: string;
      allowed: false;
      reason: MemberBidRefusal;
      /** The person has a personal account to switch to. */
      canSwitchToPersonal: boolean;
    }
  | {
      kind: "organisation";
      name: string;
      allowed: false;
      reason: "organisation_state";
      /** The organisation's state, from the policy, so the panel says when bidding opens. */
      state: OrganisationBidReasonKey;
      canSwitchToPersonal: boolean;
    };

type Input = {
  acting: Pick<LegalEntitySummary, "id" | "kind" | "displayName" | "role" | "status"> | null;
  memberships: readonly Pick<LegalEntitySummary, "kind">[];
  /** The server's answer for this sale, or `null` when it was not asked or is unavailable. */
  authority: BidAuthorityView | null;
};

function parseLimit(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Without the server's answer, the role alone says whether the account can bid at all. */
function refusalFromRole(role: LegalEntitySummary["role"]): MemberBidRefusal | null {
  return entityRoleCan(role, "entity.bid.place") ? null : "role_cannot_bid";
}

/** Refusals about the person, which hold whatever state the organisation is in. */
const PERSONAL_REFUSALS: ReadonlySet<MemberBidRefusal> = new Set(["role_cannot_bid", "not_member"]);

/** Why the organisation's state keeps bidding closed, or `null` while it is open. */
function stateRefusal(
  acting: Pick<LegalEntitySummary, "role" | "status">,
): OrganisationBidReasonKey | null {
  return organisationStatePolicy(acting.status, entityCapabilitiesOf({ role: acting.role }))
    .bidPanelReasonKey;
}

/** The account a bid on this lot is for; `null` when nobody is signed in. */
export function resolveBiddingAccount({
  acting,
  memberships,
  authority,
}: Input): BiddingAccount | null {
  const hasOrganisations = memberships.some((m) => m.kind === "organisation");
  if (!acting) return memberships.length > 0 ? { kind: "personal", hasOrganisations } : null;
  if (acting.kind !== "organisation") return { kind: "personal", hasOrganisations };

  const name = acting.displayName;
  const canSwitchToPersonal = memberships.some((m) => m.kind === "individual");
  // The server's answer when there is one; without it the role table says whether they can bid.
  const memberRefusal = authority
    ? authority.allowed
      ? null
      : authority.reason
    : refusalFromRole(acting.role);
  // Someone who can never bid for the organisation is told that, not that bidding is paused.
  if (memberRefusal && PERSONAL_REFUSALS.has(memberRefusal)) {
    return {
      kind: "organisation",
      name,
      allowed: false,
      reason: memberRefusal,
      canSwitchToPersonal,
    };
  }
  // The organisation's state comes next, so a buyer agent learns why bidding is closed before
  // being asked for an authorisation they could not use yet.
  const state = stateRefusal(acting);
  if (state) {
    return {
      kind: "organisation",
      name,
      allowed: false,
      reason: "organisation_state",
      state,
      canSwitchToPersonal,
    };
  }
  if (memberRefusal) {
    return {
      kind: "organisation",
      name,
      allowed: false,
      reason: memberRefusal,
      canSwitchToPersonal,
    };
  }
  // Without the server's answer a buyer agent's limit is unknown; the server checks every bid.
  const bidLimit = authority?.allowed ? parseLimit(authority.bidLimit) : null;
  return { kind: "organisation", name, allowed: true, bidLimit };
}

/** "Bidding as Northbank Gallery" or "Bidding as you". */
export function biddingAsLabel(account: BiddingAccount): string {
  return account.kind === "personal" ? "Bidding as you" : `Bidding as ${account.name}`;
}

/** Whether the next bid is already above a buyer agent's limit. */
export function biddingAccountOverLimit(account: BiddingAccount | null, minNextBid: number) {
  return (
    account?.kind === "organisation" &&
    account.allowed &&
    account.bidLimit != null &&
    minNextBid > account.bidLimit
  );
}

/** Whether the panel should name the account: always for organisations, and for people in one. */
export function shouldShowBiddingAs(account: BiddingAccount | null): account is BiddingAccount {
  if (!account) return false;
  return account.kind === "organisation" ? account.allowed : account.hasOrganisations;
}
