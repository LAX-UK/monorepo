import type {
  DbTransaction,
  StandingBidInstruction,
  StoppedMemberBids,
} from "@auction/persistence/interfaces";
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

/** An automatic bid that stopped because its member was removed. */
export type StoppedInstruction = Pick<
  StandingBidInstruction,
  "kind" | "id" | "lotId" | "lotTitle" | "lotNumber" | "maxAmount"
>;

/**
 * Stops a removed member's standing instructions for the organisation, inside the removal's
 * transaction, with an audit entry for each one. Placed bids stand.
 */
export interface IRemovedMemberBidStopper {
  stopFor(
    tx: DbTransaction,
    input: { legalEntityId: string; memberUserId: string; actorUserId: string },
  ): Promise<StoppedInstruction[]>;
}

/** What stopped when members left, for the people who run the organisation. */
export interface IStoppedMemberBidsQuery {
  listRecent(
    actor: OrganisationMemberActor,
  ): Promise<Result<StoppedMemberBids[], OrganisationMembershipError>>;
}

/** Realtime notice that a bidder's auto-bid ceiling is gone, so open lot pages update. */
export interface IProxyCancelledRealtime {
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void>;
}
