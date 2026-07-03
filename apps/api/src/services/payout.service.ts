import type { Database } from "@auction/db";
import type { CreatePayoutAdjustmentInput, Payout, PayoutLineKind } from "@auction/types";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IPayoutRepository } from "./interfaces/payout-repository.js";
import type {
  AdminListPayoutsFilter,
  BulkPayoutSettlementResult,
  BulkSettlementTransferPort,
  BulkSettlementWithTransfersResult,
  CreateSettlementInput,
  CreateSettlementResult,
  IPayoutService,
  ListPayoutsFilter,
  MarkPaidInput,
  PayoutWithLines,
  PendingPayoutPreview,
  StripeTransferReconciliationInput,
} from "./interfaces/payout.js";
import { PayoutNotFoundError, PayoutPermissionError } from "./interfaces/payout.js";

export type {
  IPayoutAdminService,
  IPayoutMaintenanceService,
  IPayoutSellerService,
  IPayoutService,
  IPayoutSettlementService,
} from "./interfaces/payout.js";
import {
  addAdjustment,
  adminList,
  adminManualReverse,
  markPaid,
  previewPending,
  reconcileStripeTransfer,
} from "./payout/payout-admin.js";
import { runBulkSettlementWithTransfers } from "./payout/payout-bulk-transfer.js";
import type { PayoutServiceDeps } from "./payout/payout-helpers.js";
import { createSettlement, runBulkSettlement } from "./payout/payout-settlement.js";

export class PayoutService implements IPayoutService {
  private readonly deps: PayoutServiceDeps;

  constructor(
    repo: IPayoutRepository,
    db?: Database,
    domainEventPublisher?: DomainEventPublisher,
    payoutAdjustments?: IPayoutAdjustmentService,
  ) {
    this.deps = {
      repo,
      db,
      domainEventPublisher,
      payoutAdjustments,
    };
  }

  async listForLegalEntity(
    legalEntityId: string,
    filter: ListPayoutsFilter = {},
  ): Promise<Payout[]> {
    return await this.deps.repo.list({
      legalEntityId,
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.limit !== undefined ? { limit: filter.limit } : {}),
      ...(filter.offset !== undefined ? { offset: filter.offset } : {}),
    });
  }

  async getById(legalEntityId: string, payoutId: string): Promise<PayoutWithLines> {
    const found = await this.deps.repo.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.legalEntityId !== legalEntityId) {
      throw new PayoutPermissionError("not_owner_of_payout");
    }
    const lines = await this.deps.repo.listLines(payoutId);
    return { ...found, lines };
  }

  previewPending(legalEntityId: string): Promise<PendingPayoutPreview> {
    return previewPending(this.deps, legalEntityId);
  }

  adminList(filter: AdminListPayoutsFilter = {}): Promise<Payout[]> {
    return adminList(this.deps, filter);
  }

  createSettlement(
    actorUserId: string | null,
    input: CreateSettlementInput,
  ): Promise<CreateSettlementResult> {
    return createSettlement(this.deps, actorUserId, input);
  }

  runBulkSettlement(
    actorUserId: string | null,
    opts?: { periodEnd?: Date },
  ): Promise<BulkPayoutSettlementResult> {
    return runBulkSettlement(this.deps, actorUserId, opts);
  }

  runBulkSettlementWithTransfers(
    actorUserId: string | null,
    port: BulkSettlementTransferPort,
    opts?: { periodEnd?: Date },
  ): Promise<BulkSettlementWithTransfersResult> {
    return runBulkSettlementWithTransfers(this.deps, actorUserId, port, opts);
  }

  addAdjustment(
    actorUserId: string,
    payoutId: string,
    input: CreatePayoutAdjustmentInput,
    kind: PayoutLineKind = "adjustment",
  ): Promise<PayoutWithLines> {
    return addAdjustment(this.deps, actorUserId, payoutId, input, kind);
  }

  markPaid(actorUserId: string, payoutId: string, input: MarkPaidInput): Promise<Payout> {
    return markPaid(this.deps, actorUserId, payoutId, input);
  }

  reconcileStripeTransfer(input: StripeTransferReconciliationInput): Promise<Payout | null> {
    return reconcileStripeTransfer(this.deps, input);
  }

  adminManualReverse(
    actorUserId: string,
    payoutId: string,
    input: { reason: string },
  ): Promise<Payout> {
    return adminManualReverse(this.deps, actorUserId, payoutId, input);
  }
}
