import {
  WITHDRAWAL_FORBIDDEN_MESSAGE,
  canActOnConsignmentWithdrawal,
  consignmentWithdrawalPath,
} from "@auction/domain";
import type { LotWithdrawalTaskSnapshot } from "@auction/persistence/interfaces";
import type {
  ConsignmentWithdrawalPathKind,
  ItemSubmission,
  Lot,
  LotWithdrawalRequestState,
  SellerAfterSaleView,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { withdrawalRequestedUpdate, withdrawnUpdate } from "./after-sale-copy.js";
import type { IConsignmentUpdateNotifier } from "./consignment-update-notifier.js";
import type { AfterSaleSeller } from "./unsold-lot-choice.service.js";

export type ConsignmentWithdrawalServiceDeps = {
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  lots: { findById(id: string): Promise<Lot | null> };
  withdrawalTasks: {
    findLatestLotWithdrawal(lotId: string): Promise<LotWithdrawalTaskSnapshot | null>;
  };
  /** The seller's own withdrawal of a consignment that is not catalogued yet. */
  withdrawSubmission(
    legalEntityId: string,
    submissionId: string,
  ): Promise<Result<unknown, SubmissionError>>;
  /** Opens a withdrawal request on a catalogued lot for staff to decide. */
  requestLotWithdrawal(
    sellerUserId: string,
    lotId: string,
  ): Promise<Result<{ alreadyPending: boolean }, { message: string; status?: number }>>;
  notifier: IConsignmentUpdateNotifier;
  events: IDomainEventSink | null;
};

export type ConsignmentWithdrawalOutcome = {
  /** What happened: withdrawn now, or a request now waiting for staff. */
  kind: "withdrawn" | "requested";
};

export interface IConsignmentWithdrawalService {
  sellerView(
    submission: ItemSubmission,
    seller: Pick<AfterSaleSeller, "actor">,
  ): Promise<SellerAfterSaleView["withdrawal"]>;
  staffView(submission: ItemSubmission): Promise<LotWithdrawalRequestState | null>;
  withdraw(
    submissionId: string,
    seller: AfterSaleSeller,
  ): Promise<Result<ConsignmentWithdrawalOutcome, SubmissionError>>;
}

const TASK_STATUS: Record<
  LotWithdrawalTaskSnapshot["status"],
  LotWithdrawalRequestState["status"]
> = {
  pending: "pending",
  in_progress: "pending",
  resolved: "approved",
  rejected: "declined",
};

function requestState(task: LotWithdrawalTaskSnapshot | null): LotWithdrawalRequestState | null {
  if (!task) return null;
  const status = TASK_STATUS[task.status];
  return {
    status,
    requestedAt: task.createdAt,
    decidedAt: task.resolvedAt,
    reason: status === "declined" ? task.resolutionNotes : null,
  };
}

/**
 * Taking a consignment back. Before cataloguing the seller withdraws it themselves; once it is
 * a lot they ask, and staff decide under the Conditions of Business. Which path applies and who
 * may take it come from the domain.
 */
export class ConsignmentWithdrawalService implements IConsignmentWithdrawalService {
  constructor(private readonly deps: ConsignmentWithdrawalServiceDeps) {}

  private async facts(submission: ItemSubmission): Promise<{
    lot: Lot | null;
    request: LotWithdrawalRequestState | null;
    path: ConsignmentWithdrawalPathKind;
  }> {
    const lot = submission.convertedLotId
      ? await this.deps.lots.findById(submission.convertedLotId)
      : null;
    const request = lot
      ? requestState(await this.deps.withdrawalTasks.findLatestLotWithdrawal(lot.id))
      : null;
    const path = consignmentWithdrawalPath({
      submissionStatus: submission.status,
      lot,
      pendingRequest: request?.status === "pending",
    });
    return { lot, request, path };
  }

  async sellerView(
    submission: ItemSubmission,
    seller: Pick<AfterSaleSeller, "actor">,
  ): Promise<SellerAfterSaleView["withdrawal"]> {
    const { path, request } = await this.facts(submission);
    return { path, canAct: canActOnConsignmentWithdrawal(path, seller.actor), request };
  }

  async staffView(submission: ItemSubmission): Promise<LotWithdrawalRequestState | null> {
    return (await this.facts(submission)).request;
  }

  async withdraw(
    submissionId: string,
    seller: AfterSaleSeller,
  ): Promise<Result<ConsignmentWithdrawalOutcome, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== seller.legalEntityId) {
      return err(new SubmissionError("Not found", 404));
    }
    const { lot, path } = await this.facts(submission);
    if (path === "unavailable") return err(nothingToWithdraw());
    if (!canActOnConsignmentWithdrawal(path, seller.actor)) {
      return err(new SubmissionError(WITHDRAWAL_FORBIDDEN_MESSAGE[path], 403, "forbidden_role"));
    }
    return this.handlers[path]({ submission, lot, seller });
  }

  /** One step per path the domain chose; a new path is a new entry here. */
  private readonly handlers: Record<
    Exclude<ConsignmentWithdrawalPathKind, "unavailable">,
    (input: WithdrawalStep) => Promise<Result<ConsignmentWithdrawalOutcome, SubmissionError>>
  > = {
    withdraw_now: (input) => this.withdrawNow(input),
    request: (input) => this.requestFromStaff(input),
    // Asking again while a request waits changes nothing.
    requested: async () => ok({ kind: "requested" }),
  };

  private async withdrawNow({
    submission,
    seller,
  }: WithdrawalStep): Promise<Result<ConsignmentWithdrawalOutcome, SubmissionError>> {
    const withdrawn = await this.deps.withdrawSubmission(seller.legalEntityId, submission.id);
    if (withdrawn.isErr()) return err(withdrawn.error);
    await this.deps.events?.publish({
      aggregateType: "submission",
      aggregateId: submission.id,
      eventType: "submission.withdrawn",
      payload: { submissionId: submission.id, fromStatus: submission.status },
      actorUserId: seller.userId,
      actingLegalEntityId: seller.legalEntityId,
      schemaVersion: 1,
    });
    await this.deps.notifier.notify(
      [{ legalEntityId: seller.legalEntityId, audience: "seller" }],
      withdrawnUpdate({ submissionId: submission.id, title: submission.title }),
    );
    return ok({ kind: "withdrawn" });
  }

  private async requestFromStaff({
    submission,
    lot,
    seller,
  }: WithdrawalStep): Promise<Result<ConsignmentWithdrawalOutcome, SubmissionError>> {
    if (!lot) return err(nothingToWithdraw());
    const requested = await this.deps.requestLotWithdrawal(seller.userId, lot.id);
    if (requested.isErr()) {
      return err(new SubmissionError(requested.error.message, requested.error.status ?? 409));
    }
    if (!requested.value.alreadyPending) {
      await this.deps.notifier.notify(
        [{ legalEntityId: seller.legalEntityId, audience: "seller" }],
        withdrawalRequestedUpdate({ submissionId: submission.id, title: submission.title }),
      );
    }
    return ok({ kind: "requested" });
  }
}

type WithdrawalStep = { submission: ItemSubmission; lot: Lot | null; seller: AfterSaleSeller };

function nothingToWithdraw(): SubmissionError {
  return new SubmissionError("There is nothing to withdraw for this consignment.", 409);
}
