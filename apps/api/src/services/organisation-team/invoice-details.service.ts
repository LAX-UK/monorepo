import { entityActorCan } from "@auction/domain";
import type { IInvoiceDetailsRepository, InvoiceDetails } from "@auction/persistence/interfaces";
import type { UpdateInvoiceDetailsInput } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IInvoiceDetailsService,
  InvoiceDetailsView,
  OrganisationTeamError,
} from "../interfaces/organisation-team-service.js";

const FORBIDDEN_READ: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners, admins and finance can see the organisation's invoice details.",
};

const FORBIDDEN_WRITE: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners, admins and finance can change the organisation's invoice details.",
};

const EMPTY: InvoiceDetails = {
  billingEmail: null,
  address: null,
  poReference: null,
  updatedAt: null,
};

type Field = "billing_email" | "address" | "po_reference";

/** Which fields changed, for Activity: names only, never the values. */
function changedFields(before: InvoiceDetails, after: UpdateInvoiceDetailsInput): Field[] {
  const fields: Field[] = [];
  if (before.billingEmail !== after.billingEmail) fields.push("billing_email");
  if (JSON.stringify(before.address) !== JSON.stringify(after.address)) fields.push("address");
  if (before.poReference !== after.poReference) fields.push("po_reference");
  return fields;
}

/**
 * Invoice details are read by everyone who sees the organisation's money and changed by those
 * who manage it (owners, admins and finance). A change is recorded in Activity.
 */
export class InvoiceDetailsService implements IInvoiceDetailsService {
  constructor(
    private readonly deps: { details: IInvoiceDetailsRepository; events: IDomainEventSink },
  ) {}

  async view(
    actor: OrganisationMemberActor,
  ): Promise<Result<InvoiceDetailsView, OrganisationTeamError>> {
    if (!entityActorCan({ role: actor.role }, "entity.finance.read")) return err(FORBIDDEN_READ);
    const details = (await this.deps.details.find(actor.legalEntityId)) ?? EMPTY;
    return ok({ ...details, canEdit: entityActorCan(actor, "entity.invoice_details.manage") });
  }

  async update(
    actor: OrganisationMemberActor,
    input: UpdateInvoiceDetailsInput,
  ): Promise<Result<InvoiceDetailsView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.invoice_details.manage")) return err(FORBIDDEN_WRITE);
    const before = (await this.deps.details.find(actor.legalEntityId)) ?? EMPTY;
    const fields = changedFields(before, input);
    if (fields.length === 0) return ok({ ...before, canEdit: true });
    const saved = await this.deps.details.save(actor.legalEntityId, input, actor.userId);
    await this.deps.events.publish({
      aggregateType: "legal_entity",
      aggregateId: actor.legalEntityId,
      eventType: "legal_entity.invoice_details_changed",
      payload: { changed_fields: fields },
      actorUserId: actor.userId,
      actingLegalEntityId: actor.legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
    return ok({ ...saved, canEdit: true });
  }
}
