import {
  CONSIGNMENT_MOVABLE_STATUSES,
  CONSIGNMENT_MOVE_REFUSAL_MESSAGES,
  type ConsignmentMoveAgreementEffect,
  consignmentMoveAgreementEffect,
  consignmentMoveSourceRefusal,
  consignmentMoveTargetRefusal,
  decideConsignmentMove,
} from "@auction/domain";
import type { IConsignmentMoveWriter } from "@auction/persistence/interfaces";
import type {
  ConsignmentAgreement,
  ConsignmentMoveOptions,
  ConsignmentMoveRefusal,
  ItemSubmission,
  LegalEntity,
  LegalEntitySummary,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { consignmentMovedUpdate } from "./after-sale-copy.js";
import type { IConsignmentUpdateNotifier } from "./consignment-update-notifier.js";

export type ConsignmentMoveServiceDeps = {
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  entities: { findById(id: string): Promise<LegalEntity | null> };
  memberships: { listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]> };
  /** The person a personal account belongs to. */
  personOf(legalEntityId: string): Promise<string | null>;
  agreements: { findBySubmissionId(id: string): Promise<ConsignmentAgreement | null> };
  writer: IConsignmentMoveWriter;
  notifier: IConsignmentUpdateNotifier;
  events: IDomainEventSink | null;
  now?: () => Date;
};

export type ConsignmentMoveResult = {
  legalEntityId: string;
  agreement: ConsignmentMoveAgreementEffect;
};

export interface IConsignmentMoveService {
  options(submissionId: string): Promise<Result<ConsignmentMoveOptions, SubmissionError>>;
  move(
    submissionId: string,
    staffUserId: string,
    targetLegalEntityId: string,
  ): Promise<Result<ConsignmentMoveResult, SubmissionError>>;
}

const REFUSAL_STATUS: Record<ConsignmentMoveRefusal, number> = {
  not_found: 404,
  not_personal: 409,
  catalogued: 409,
  closed: 409,
  same_account: 409,
  not_member: 409,
  role_cannot_submit: 409,
  organisation_cannot_submit: 409,
};

function refused(reason: ConsignmentMoveRefusal): SubmissionError {
  return new SubmissionError(
    CONSIGNMENT_MOVE_REFUSAL_MESSAGES[reason],
    REFUSAL_STATUS[reason],
    reason,
  );
}

type Source = { submission: ItemSubmission; entity: LegalEntity; personId: string | null };

/**
 * Staff move a personal consignment to one of the seller's organisations, on the seller's
 * request. Only organisations the seller could hand the work in for are offered. The move is
 * audited and both the person and the organisation's owners and admins are told; an agreement
 * the person accepted in their own name is proposed again to the organisation.
 */
export class ConsignmentMoveService implements IConsignmentMoveService {
  constructor(private readonly deps: ConsignmentMoveServiceDeps) {}

  private async source(submissionId: string): Promise<Result<Source, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission?.legalEntityId) return err(refused("not_found"));
    const entity = await this.deps.entities.findById(submission.legalEntityId);
    if (!entity) return err(refused("not_found"));
    const personId = entity.kind === "individual" ? await this.deps.personOf(entity.id) : null;
    return ok({ submission, entity, personId });
  }

  async options(submissionId: string): Promise<Result<ConsignmentMoveOptions, SubmissionError>> {
    const loaded = await this.source(submissionId);
    if (loaded.isErr()) return err(loaded.error);
    const { submission, entity, personId } = loaded.value;
    const agreement = await this.deps.agreements.findBySubmissionId(submission.id);
    const agreementEffect = consignmentMoveAgreementEffect(agreement);
    const sourceFacts = { status: submission.status, legalEntityKind: entity.kind };
    const sourceRefusal = consignmentMoveSourceRefusal(sourceFacts);
    if (sourceRefusal) {
      return ok({
        movable: false,
        reason: CONSIGNMENT_MOVE_REFUSAL_MESSAGES[sourceRefusal],
        options: [],
        agreementEffect,
      });
    }
    const memberships = personId
      ? await this.deps.memberships.listActiveMembershipsForUser(personId)
      : [];
    const options = memberships
      .filter(
        (m) =>
          consignmentMoveTargetRefusal({
            submission: sourceFacts,
            sourceLegalEntityId: entity.id,
            target: { legalEntityId: m.id, kind: m.kind, status: m.status, sellerRole: m.role },
          }) === null,
      )
      .map((m) => ({ legalEntityId: m.id, displayName: m.displayName, role: m.role }));
    return ok({
      movable: options.length > 0,
      reason:
        options.length > 0
          ? null
          : "The seller is not a member of an organisation they could hand this work in for.",
      options,
      agreementEffect,
    });
  }

  async move(
    submissionId: string,
    staffUserId: string,
    targetLegalEntityId: string,
  ): Promise<Result<ConsignmentMoveResult, SubmissionError>> {
    const loaded = await this.source(submissionId);
    if (loaded.isErr()) return err(loaded.error);
    const { submission, entity, personId } = loaded.value;
    const [target, agreement, memberships] = await Promise.all([
      this.deps.entities.findById(targetLegalEntityId),
      this.deps.agreements.findBySubmissionId(submission.id),
      personId ? this.deps.memberships.listActiveMembershipsForUser(personId) : Promise.resolve([]),
    ]);
    if (!target) return err(refused("not_found"));
    const membership = memberships.find((m) => m.id === target.id) ?? null;
    const decision = decideConsignmentMove({
      submission: { status: submission.status, legalEntityKind: entity.kind },
      target: {
        legalEntityId: target.id,
        kind: target.kind,
        status: target.status,
        sellerRole: membership?.role ?? null,
      },
      sourceLegalEntityId: entity.id,
      agreement,
    });
    if (decision.kind === "refused") return err(refused(decision.reason));

    const movedAt = this.deps.now?.() ?? new Date();
    const moved = await this.deps.writer.move({
      submissionId: submission.id,
      fromLegalEntityId: entity.id,
      toLegalEntityId: target.id,
      movableStatuses: CONSIGNMENT_MOVABLE_STATUSES,
      resetAgreementAcceptance: decision.agreement === "reset",
      sellerUserId: personId,
      movedAt,
    });
    // It changed between our read and our write (catalogued, withdrawn or moved already).
    if (!moved) {
      return err(new SubmissionError("The consignment changed. Reload it and try again.", 409));
    }

    await this.deps.events?.publish({
      aggregateType: "submission",
      aggregateId: submission.id,
      eventType: "submission.moved_to_organisation",
      payload: {
        submissionId: submission.id,
        fromLegalEntityId: entity.id,
        toLegalEntityId: target.id,
        agreement: decision.agreement,
      },
      actorUserId: staffUserId,
      actingLegalEntityId: target.id,
      schemaVersion: 1,
    });
    const update = consignmentMovedUpdate({
      submissionId: submission.id,
      title: submission.title,
      organisationName: target.displayName,
      agreement: decision.agreement,
    });
    await this.deps.notifier.notify(
      [
        { legalEntityId: entity.id, audience: "admin" },
        { legalEntityId: target.id, audience: "admin" },
      ],
      update,
    );
    return ok({ legalEntityId: target.id, agreement: decision.agreement });
  }
}
