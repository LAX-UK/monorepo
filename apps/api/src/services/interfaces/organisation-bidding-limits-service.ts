import type { OrganisationBiddingLimitsView } from "@auction/types";
import type { SetOrganisationBiddingLimitInput } from "@auction/validators";
import type { Result } from "neverthrow";
import type { BuyerAgentManager } from "./buyer-agent-authorisation-service.js";

export type OrganisationBiddingLimitsError = {
  code: "forbidden";
  status: 403;
  message: string;
};

/**
 * An organisation's bidding limits and what is in use under them: everyone who bids for it can
 * read them; owners and admins (and LAX staff) set or remove the organisation-wide limit.
 */
export interface IOrganisationBiddingLimitsService {
  view(
    actor: BuyerAgentManager,
    legalEntityId: string,
  ): Promise<Result<OrganisationBiddingLimitsView, OrganisationBiddingLimitsError>>;
  setOrganisationLimit(
    actor: BuyerAgentManager,
    legalEntityId: string,
    input: SetOrganisationBiddingLimitInput,
  ): Promise<Result<OrganisationBiddingLimitsView, OrganisationBiddingLimitsError>>;
}
