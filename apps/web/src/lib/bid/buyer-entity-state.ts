import {
  type OrganisationBidReasonKey,
  entityCapabilitiesOf,
  organisationStatePolicy,
} from "@auction/domain";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";

/** A membership as the bid and registration flows read it. */
export type BuyerMembership = {
  id: string;
  displayName: string;
  role: LegalEntityMemberRole;
  status: LegalEntityStatus;
};

export type PausedBuyerMembership<M extends BuyerMembership = BuyerMembership> = M & {
  /** Why bidding and registering for it are closed, from the organisation state policy. */
  reason: OrganisationBidReasonKey;
};

/**
 * Splits the person's accounts by whether the account's state lets anyone bid or register for
 * it, using the same table as the server (bidding and registering share one rule). Accounts
 * whose state closes bidding are kept with the reason, so the page can say why before the person
 * tries rather than leaving them out silently.
 */
export function splitBuyerMembershipsByState<M extends BuyerMembership>(
  memberships: readonly M[],
): { open: M[]; paused: PausedBuyerMembership<M>[] } {
  const open: M[] = [];
  const paused: PausedBuyerMembership<M>[] = [];
  for (const membership of memberships) {
    const policy = organisationStatePolicy(
      membership.status,
      entityCapabilitiesOf({ role: membership.role }),
    );
    if (policy.actions.bid && policy.actions.register) open.push(membership);
    else if (policy.bidPanelReasonKey)
      paused.push({ ...membership, reason: policy.bidPanelReasonKey });
  }
  return { open, paused };
}
