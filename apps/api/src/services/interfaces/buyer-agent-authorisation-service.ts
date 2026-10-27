import type {
  BidAuthorityView,
  BuyerAgentAuthorisationOverview,
  BuyerAgentAuthorisationView,
  LegalEntityMemberRole,
} from "@auction/types";
import type { AuthoriseBuyerAgentInput } from "@auction/validators";
import type { Result } from "neverthrow";

/**
 * Who is managing an organisation's buyer agents: one of its members (owners and admins may),
 * or LAX staff, whose staff capability the admin routes have already checked.
 */
export type BuyerAgentManager =
  | {
      kind: "member";
      userId: string;
      legalEntityId: string;
      role: LegalEntityMemberRole;
      isImpersonation?: boolean | undefined;
    }
  | { kind: "staff"; userId: string };

export type BuyerAgentAuthorisationErrorCode =
  | "forbidden"
  | "member_not_buyer_agent"
  | "sale_not_open"
  | "invalid_window"
  | "authorisation_not_found"
  | "already_revoked";

export type BuyerAgentAuthorisationError = {
  code: BuyerAgentAuthorisationErrorCode;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export interface IBuyerAgentAuthorisationService {
  overview(
    manager: BuyerAgentManager,
    legalEntityId: string,
  ): Promise<Result<BuyerAgentAuthorisationOverview, BuyerAgentAuthorisationError>>;
  authorise(
    manager: BuyerAgentManager,
    legalEntityId: string,
    input: AuthoriseBuyerAgentInput,
  ): Promise<Result<BuyerAgentAuthorisationView, BuyerAgentAuthorisationError>>;
  revoke(
    manager: BuyerAgentManager,
    legalEntityId: string,
    authorisationId: string,
    reason: string,
  ): Promise<Result<BuyerAgentAuthorisationView, BuyerAgentAuthorisationError>>;
}

/** Answers "may I bid for this account in this sale?" for the bid panel. */
export interface IBidAuthorityQueryService {
  forSale(input: {
    userId: string;
    legalEntityId: string;
    saleId: string | null;
  }): Promise<BidAuthorityView>;
}
