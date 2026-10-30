import { consignmentReference, entityActorCan } from "@auction/domain";
import type { ConsignmentAgreementDocument } from "@auction/exports/documents";
import type {
  IAgreementDocumentFactsReader,
  IRecordPeopleReader,
} from "@auction/persistence/interfaces";
import type { ConsignmentAgreement } from "@auction/types";
import { err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IAgreementDocumentService,
  SellingResult,
} from "../interfaces/organisation-selling-service.js";
import type { ISubmissionAccessGuard } from "../interfaces/submission-routes/submission-access.js";
import { entityActorOf, sellingError } from "./selling-errors.js";

/** The stored agreement for a submission. */
export interface IAgreementLookup {
  findBySubmissionId(submissionId: string): Promise<ConsignmentAgreement | null>;
}

export type RenderAgreementPdf = (document: ConsignmentAgreementDocument) => Promise<Buffer>;

/**
 * The consignment agreement as a PDF. Everyone who follows the account's consignments may keep a
 * copy of one they can see (the same "Not found" as the consignment for one they cannot); it is
 * rendered from the stored agreement, so the copy always matches what was proposed and accepted.
 */
export class AgreementDocumentService implements IAgreementDocumentService {
  constructor(
    private readonly deps: {
      facts: IAgreementDocumentFactsReader;
      agreements: IAgreementLookup;
      people: IRecordPeopleReader;
      access: Pick<ISubmissionAccessGuard, "hides">;
      render: RenderAgreementPdf;
    },
  ) {}

  async render(
    actor: OrganisationMemberActor,
    submissionId: string,
  ): SellingResult<{ filename: string; pdf: Buffer }> {
    const entityActor = entityActorOf(actor);
    if (!entityActorCan(entityActor, "entity.consignments.read")) {
      return err(sellingError("insufficient_entity_role"));
    }
    const facts = await this.deps.facts.factsFor(submissionId);
    const hidden =
      !facts ||
      facts.legalEntityId !== actor.legalEntityId ||
      (await this.deps.access.hides(
        {
          legalEntityId: actor.legalEntityId,
          member: { userId: actor.userId, actor: entityActor },
        },
        submissionId,
      ));
    if (hidden || !facts) return err(sellingError("agreement_not_found"));
    const agreement = await this.deps.agreements.findBySubmissionId(submissionId);
    if (!agreement) return err(sellingError("agreement_not_found"));

    const acceptedBy = agreement.acceptedByUserId
      ? ((await this.deps.people.namesFor([agreement.acceptedByUserId])).get(
          agreement.acceptedByUserId,
        ) ?? null)
      : null;
    const reference = consignmentReference(facts.referenceNumber);
    const pdf = await this.deps.render({
      reference,
      workTitle: facts.workTitle,
      sellerName: facts.sellerName,
      currency: agreement.currency,
      estimateLow: agreement.estimateLow,
      estimateHigh: agreement.estimateHigh,
      reservePrice: agreement.reservePrice,
      commissionPercent: agreement.commissionPercent,
      relistReserveFloor: agreement.relistReserveFloor ?? null,
      termsVersion: agreement.termsVersion,
      proposedAt: agreement.proposedAt,
      accepted: agreement.acceptedAt ? { byName: acceptedBy, at: agreement.acceptedAt } : null,
    });
    return ok({ filename: `consignment-agreement-${reference}.pdf`, pdf });
  }
}
