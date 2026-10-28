import {
  type EntityActor,
  type UnsoldChoiceRefusal,
  type UnsoldChoiceState,
  canChooseUnsoldOutcome,
  decideUnsoldChoiceConfirmation,
  decideUnsoldChoiceRequest,
  lotEndedUnsold,
  relistReserveRefusal,
  unsoldChoiceRefusalMessage,
} from "@auction/domain";
import type {
  IConsignmentAgreementRepository,
  IUnsoldLotChoiceRepository,
} from "@auction/persistence/interfaces";
import type {
  ConsignmentAgreement,
  ItemSubmission,
  Lot,
  SellerUnsoldLotView,
  UnsoldLotChoice,
  UnsoldLotChoiceDecisionInput,
  UnsoldLotChoiceRequestInput,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { unsoldChoiceConfirmedUpdate, unsoldChoiceRequestedUpdate } from "./after-sale-copy.js";
import type { IConsignmentUpdateNotifier } from "./consignment-update-notifier.js";

/** The signed-in seller, the account they act for and their standing with it. */
export type AfterSaleSeller = {
  userId: string;
  legalEntityId: string;
  /** `null` for a person's own profile, which they always own. */
  actor: EntityActor | null;
};

export type UnsoldLotChoiceServiceDeps = {
  choices: IUnsoldLotChoiceRepository;
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  lots: { findById(id: string): Promise<Lot | null> };
  agreements: Pick<IConsignmentAgreementRepository, "findBySubmissionId" | "setRelistReserveFloor">;
  people: { findById(id: string): Promise<{ name: string } | null> };
  notifier: IConsignmentUpdateNotifier;
  events: IDomainEventSink | null;
  now?: () => Date;
};

export interface IUnsoldLotChoiceService {
  /** The unsold lot behind a consignment, or `null` while it has not ended unsold. */
  sellerView(
    submission: ItemSubmission,
    actor: EntityActor | null,
  ): Promise<SellerUnsoldLotView | null>;
  staffView(submission: ItemSubmission): Promise<Omit<SellerUnsoldLotView, "canChoose"> | null>;
  request(
    submissionId: string,
    seller: AfterSaleSeller,
    input: UnsoldLotChoiceRequestInput,
  ): Promise<Result<UnsoldLotChoice, SubmissionError>>;
  decide(
    submissionId: string,
    staffUserId: string,
    input: UnsoldLotChoiceDecisionInput,
  ): Promise<Result<UnsoldLotChoice, SubmissionError>>;
  setReserveFloor(
    submissionId: string,
    floor: string | null,
  ): Promise<Result<ConsignmentAgreement, SubmissionError>>;
}

const REFUSAL_STATUS: Record<UnsoldChoiceRefusal, number> = {
  not_unsold: 409,
  already_confirmed: 409,
  forbidden_role: 403,
  reserve_only_for_relist: 400,
  reserve_invalid: 400,
  reserve_not_lower: 400,
  reserve_below_floor: 400,
  note_required: 400,
};

type UnsoldContext = {
  submission: ItemSubmission;
  lot: Lot;
  agreement: ConsignmentAgreement | null;
  choice: UnsoldLotChoice | null;
};

function stateOf(choice: UnsoldLotChoice | null): UnsoldChoiceState {
  return choice?.status ?? "none";
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * What happens to a consigned lot that did not sell: the seller asks (relist, perhaps with a lower
 * reserve, private sale, or collection), a specialist confirms or adjusts it, and both sides are
 * told. The rules live in the domain; this service fetches the facts and records the outcome.
 */
export class UnsoldLotChoiceService implements IUnsoldLotChoiceService {
  constructor(private readonly deps: UnsoldLotChoiceServiceDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private async withNames(choice: UnsoldLotChoice): Promise<UnsoldLotChoice> {
    const name = async (id: string | null) =>
      id ? ((await this.deps.people.findById(id).catch(() => null))?.name ?? null) : null;
    const [requestedByName, decidedByName] = await Promise.all([
      name(choice.requestedByUserId),
      name(choice.decidedByUserId),
    ]);
    return { ...choice, requestedByName, decidedByName };
  }

  /** The consignment's lot once it ended unsold, with what has been chosen for this outcome. */
  private async unsoldContext(submission: ItemSubmission): Promise<UnsoldContext | null> {
    if (!submission.convertedLotId) return null;
    const lot = await this.deps.lots.findById(submission.convertedLotId);
    if (!lot || !lotEndedUnsold(lot)) return null;
    const [agreement, choice] = await Promise.all([
      this.deps.agreements.findBySubmissionId(submission.id),
      this.deps.choices.findForOutcome({ lotId: lot.id, lotEndTime: lot.endTime }),
    ]);
    return { submission, lot, agreement, choice };
  }

  private async view(context: UnsoldContext): Promise<Omit<SellerUnsoldLotView, "canChoose">> {
    return {
      lotId: context.lot.id,
      currentReserve: context.lot.reservePrice,
      reserveFloor: context.agreement?.relistReserveFloor ?? null,
      currency: context.agreement?.currency ?? "GBP",
      choice: context.choice ? await this.withNames(context.choice) : null,
    };
  }

  async sellerView(
    submission: ItemSubmission,
    actor: EntityActor | null,
  ): Promise<SellerUnsoldLotView | null> {
    const context = await this.unsoldContext(submission);
    if (!context) return null;
    return { ...(await this.view(context)), canChoose: canChooseUnsoldOutcome(actor) };
  }

  async staffView(
    submission: ItemSubmission,
  ): Promise<Omit<SellerUnsoldLotView, "canChoose"> | null> {
    const context = await this.unsoldContext(submission);
    return context ? this.view(context) : null;
  }

  private refused(reason: UnsoldChoiceRefusal): SubmissionError {
    return new SubmissionError(unsoldChoiceRefusalMessage(reason), REFUSAL_STATUS[reason], reason);
  }

  async request(
    submissionId: string,
    seller: AfterSaleSeller,
    input: UnsoldLotChoiceRequestInput,
  ): Promise<Result<UnsoldLotChoice, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== seller.legalEntityId) {
      return err(new SubmissionError("Not found", 404));
    }
    const context = await this.unsoldContext(submission);
    if (!context) return err(this.refused("not_unsold"));
    const reserve = trimmedOrNull(input.reserve);
    const decision = decideUnsoldChoiceRequest({
      lot: context.lot,
      current: stateOf(context.choice),
      actor: seller.actor,
      choice: input.choice,
      reserve,
      floor: context.agreement?.relistReserveFloor ?? null,
    });
    if (decision.kind === "refused") return err(this.refused(decision.reason));

    const stored = await this.deps.choices.saveRequest({
      lotId: context.lot.id,
      lotEndTime: context.lot.endTime,
      submissionId,
      legalEntityId: seller.legalEntityId,
      currency: context.agreement?.currency ?? "GBP",
      choice: input.choice,
      reserve,
      requestedByUserId: seller.userId,
      requestedAt: this.now(),
    });
    // A specialist confirmed between our read and our write.
    if (!stored) return err(this.refused("already_confirmed"));

    await this.deps.events?.publish({
      aggregateType: "submission",
      aggregateId: submissionId,
      eventType: "submission.unsold_choice_requested",
      payload: {
        submissionId,
        lotId: context.lot.id,
        choice: input.choice,
        reserve,
        transition: decision.transition,
      },
      actorUserId: seller.userId,
      actingLegalEntityId: seller.legalEntityId,
      schemaVersion: 1,
    });
    await this.deps.notifier.notify(
      [{ legalEntityId: seller.legalEntityId, audience: "seller" }],
      unsoldChoiceRequestedUpdate({ submissionId, title: submission.title, choice: input.choice }),
    );
    return ok(await this.withNames(stored));
  }

  async decide(
    submissionId: string,
    staffUserId: string,
    input: UnsoldLotChoiceDecisionInput,
  ): Promise<Result<UnsoldLotChoice, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission?.legalEntityId) return err(new SubmissionError("Not found", 404));
    const context = await this.unsoldContext(submission);
    if (!context) return err(this.refused("not_unsold"));
    const reserve = trimmedOrNull(input.reserve);
    const note = trimmedOrNull(input.note);
    const decision = decideUnsoldChoiceConfirmation({
      lot: context.lot,
      current: stateOf(context.choice),
      requested: context.choice
        ? { choice: context.choice.requestedChoice, reserve: context.choice.requestedReserve }
        : null,
      choice: input.choice,
      reserve,
      note,
    });
    if (decision.kind === "refused") return err(this.refused(decision.reason));

    const currency = context.agreement?.currency ?? "GBP";
    const stored = await this.deps.choices.saveDecision({
      lotId: context.lot.id,
      lotEndTime: context.lot.endTime,
      submissionId,
      legalEntityId: submission.legalEntityId,
      currency,
      choice: input.choice,
      reserve,
      note,
      decidedByUserId: staffUserId,
      decidedAt: this.now(),
    });
    if (!stored) return err(this.refused("already_confirmed"));

    await this.deps.events?.publish({
      aggregateType: "submission",
      aggregateId: submissionId,
      eventType: "submission.unsold_choice_confirmed",
      payload: {
        submissionId,
        lotId: context.lot.id,
        choice: input.choice,
        reserve,
        transition: decision.transition,
      },
      actorUserId: staffUserId,
      actingLegalEntityId: submission.legalEntityId,
      schemaVersion: 1,
    });
    await this.deps.notifier.notify(
      [{ legalEntityId: submission.legalEntityId, audience: "seller" }],
      unsoldChoiceConfirmedUpdate({
        submissionId,
        title: submission.title,
        choice: input.choice,
        reserve,
        currency,
        note,
      }),
    );
    return ok(await this.withNames(stored));
  }

  async setReserveFloor(
    submissionId: string,
    floor: string | null,
  ): Promise<Result<ConsignmentAgreement, SubmissionError>> {
    const value = trimmedOrNull(floor);
    if (value !== null) {
      const refusal = relistReserveRefusal({ reserve: value, currentReserve: null, floor: null });
      if (refusal) return err(this.refused(refusal));
    }
    const stored = await this.deps.agreements.setRelistReserveFloor(
      submissionId,
      value,
      this.now(),
    );
    if (!stored) {
      return err(new SubmissionError("This consignment has no agreement to set a floor on.", 404));
    }
    return ok(stored);
  }
}
