import { entityActorCan } from "@auction/domain";
import type {
  IOrganisationAddressRepository,
  OrganisationAddress,
} from "@auction/persistence/interfaces";
import type { AddOrganisationAddressInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IOrganisationAddressService,
  OrganisationAddressesView,
  OrganisationTeamError,
} from "../interfaces/organisation-team-service.js";

const FORBIDDEN_READ: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only the people who buy for the organisation can see its delivery addresses.",
};

const FORBIDDEN_ADD: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only the people who buy for the organisation can add a delivery address.",
};

/**
 * The addresses a purchase can be delivered to for an organisation: its registered address and the
 * delivery addresses added for it. Those who buy for it read and add them; roles that only follow
 * its records neither see nor add.
 */
export class OrganisationAddressService implements IOrganisationAddressService {
  constructor(private readonly deps: { addresses: IOrganisationAddressRepository }) {}

  async list(
    actor: OrganisationMemberActor,
  ): Promise<Result<OrganisationAddressesView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.delivery_addresses.read")) return err(FORBIDDEN_READ);
    const addresses = await this.deps.addresses.list(actor.legalEntityId);
    return ok({ addresses, canAdd: entityActorCan(actor, "entity.delivery_addresses.manage") });
  }

  async add(
    actor: OrganisationMemberActor,
    input: AddOrganisationAddressInput,
  ): Promise<Result<OrganisationAddress, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.delivery_addresses.manage")) return err(FORBIDDEN_ADD);
    return ok(await this.deps.addresses.addDelivery(actor.legalEntityId, input));
  }
}
