import { entityActorCan } from "@auction/domain";
import type { ContactDetails, IContactDetailsRepository } from "@auction/persistence/interfaces";
import type { UpdateContactDetailsInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  ContactDetailsView,
  IContactDetailsService,
} from "../interfaces/organisation-profile-service.js";
import type { OrganisationTeamError } from "../interfaces/organisation-team-service.js";

const FORBIDDEN_READ: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only members of this organisation can see its contact details.",
};

const FORBIDDEN_WRITE: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners and admins can change the organisation's contact details.",
};

const EMPTY: ContactDetails = { email: null, phone: null, website: null, updatedAt: null };

const FIELDS = ["email", "phone", "website"] as const;

/** Which fields changed, for the audit record: names only, never the values. */
function changedFields(before: ContactDetails, after: UpdateContactDetailsInput): string[] {
  return FIELDS.filter((field) => before[field] !== after[field]);
}

/**
 * Contact details are read by every member and changed by the people who run the organisation.
 * They are not part of the organisation check, so a change applies at once and is recorded.
 */
export class ContactDetailsService implements IContactDetailsService {
  constructor(
    private readonly deps: { details: IContactDetailsRepository; events: IDomainEventSink },
  ) {}

  async view(
    actor: OrganisationMemberActor,
  ): Promise<Result<ContactDetailsView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.contact.read")) return err(FORBIDDEN_READ);
    const details = (await this.deps.details.find(actor.legalEntityId)) ?? EMPTY;
    return ok({ ...details, canEdit: entityActorCan(actor, "entity.contact.manage") });
  }

  async update(
    actor: OrganisationMemberActor,
    input: UpdateContactDetailsInput,
  ): Promise<Result<ContactDetailsView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.contact.manage")) return err(FORBIDDEN_WRITE);
    const before = (await this.deps.details.find(actor.legalEntityId)) ?? EMPTY;
    const fields = changedFields(before, input);
    if (fields.length === 0) return ok({ ...before, canEdit: true });
    const saved = await this.deps.details.save(actor.legalEntityId, input, actor.userId);
    await this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: actor.legalEntityId,
      eventType: "legal_entity.contact_details_changed",
      payload: { changed_fields: fields },
      actorUserId: actor.userId,
      actingLegalEntityId: actor.legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
    return ok({ ...saved, canEdit: true });
  }
}
