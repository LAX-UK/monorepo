import type { FormerMemberBidRef, FormerMemberOpenBid } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import type { Result } from "neverthrow";

/** The signed-in member acting for an organisation (from the legal-entity context). */
export type OrganisationMemberActor = {
  userId: string;
  legalEntityId: string;
  role: LegalEntityMemberRole;
  isImpersonation?: boolean | undefined;
};

export type OrganisationMembershipErrorCode = "forbidden" | "not_found";

export type OrganisationMembershipError = {
  code: OrganisationMembershipErrorCode;
  status: 403 | 404;
  message: string;
};

/** The one-time welcome card after accepting an invitation. */
export interface IMemberWelcomeService {
  dismiss(actor: OrganisationMemberActor): Promise<Result<void, OrganisationMembershipError>>;
}

/** Bids that former members left standing for the organisation, and cancelling them. */
export interface IFormerMemberBidsService {
  list(
    actor: OrganisationMemberActor,
  ): Promise<Result<FormerMemberOpenBid[], OrganisationMembershipError>>;
  cancel(
    actor: OrganisationMemberActor,
    ref: FormerMemberBidRef,
  ): Promise<Result<FormerMemberOpenBid, OrganisationMembershipError>>;
}

/** Realtime notice that a bidder's auto-bid maximum is gone, so open lot pages update. */
export interface IProxyCancelledRealtime {
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void>;
}
