import { accountBidScope } from "@auction/domain";
import type {
  AccountRegistrationRow,
  IAccountRegistrationsReader,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IAccountRegistrationsService,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { buyingError, entityActorOf } from "./purchase-view.js";

/**
 * Registrations follow bids: members who bid without an authorisation (owners, admins) see every
 * registration for the account, buyer agents their own, and other roles none.
 */
export class AccountRegistrationsService implements IAccountRegistrationsService {
  constructor(private readonly reader: IAccountRegistrationsReader) {}

  async list(actor: OrganisationMemberActor): BuyingResult<AccountRegistrationRow[]> {
    const scope = accountBidScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    return ok(
      await this.reader.list({
        legalEntityId: actor.legalEntityId,
        memberUserId: scope === "own" ? actor.userId : null,
      }),
    );
  }
}
