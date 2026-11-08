import type { CreatePayoutAdjustmentInput, ResolveBlockedPayoutInput } from "@auction/validators";
import type { IAdminPayoutApplicationService } from "../interfaces/admin-routes/admin-finance-routes.js";
import type { IPayoutStatementApplicationService } from "../interfaces/finance-routes/finance-payout-statement.js";
import type {
  CreateSettlementResult,
  IPayoutAdminService,
  IPayoutSettlementService,
  PayoutReversalActor,
} from "../interfaces/payout.js";
import type { AdminListPayoutsFilter } from "../interfaces/payout.js";
import type { SettlementPeriodRefusal } from "../payout/settlement-period.js";
import { resolveSettlementPeriod } from "../payout/settlement-period.js";
import type { AdminBlockedPayoutResolutionService } from "./admin-blocked-payout-resolution.service.js";
import type { AdminFailedPayoutRetryService } from "./admin-failed-payout-retry.service.js";
import type { AdminPayoutListPage } from "./admin-payout-list-query.service.js";

export class AdminPayoutApplicationService implements IAdminPayoutApplicationService {
  constructor(
    private readonly payouts: IPayoutAdminService,
    private readonly settlements: IPayoutSettlementService,
    private readonly payoutStatement: IPayoutStatementApplicationService,
    private readonly failedRetries: Pick<AdminFailedPayoutRetryService, "retry">,
    private readonly blockedResolutions: Pick<AdminBlockedPayoutResolutionService, "resolve">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  adminListPage(
    filter: AdminListPayoutsFilter & { limit: number; offset: number },
  ): Promise<AdminPayoutListPage> {
    return this.payouts.adminListPage(filter);
  }

  adminSettlementPreview(legalEntityId: string) {
    return this.payouts.adminSettlementPreview(legalEntityId);
  }

  /**
   * Settles one entity for the period after its last settled one. The period is worked out here
   * from the stored payouts, never taken as open-ended, and an overlap is refused.
   */
  async createSettlement(
    actorUserId: string,
    input: { legalEntityId: string; reason: string; periodStart?: Date },
  ): Promise<CreateSettlementResult | { ok: false; reason: SettlementPeriodRefusal }> {
    const [latest] = await this.payouts.adminList({ legalEntityId: input.legalEntityId, limit: 1 });
    const { pending } = await this.payouts.adminSettlementPreview(input.legalEntityId);
    const period = resolveSettlementPeriod({
      now: this.now(),
      requestedStart: input.periodStart,
      lastSettledEnd: latest?.periodEnd ?? null,
      earliestPending: pending.earliestCapturedAt ?? null,
    });
    if (!period.ok) return period;
    return this.settlements.createSettlement(actorUserId, {
      legalEntityId: input.legalEntityId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      reason: input.reason,
    });
  }

  addAdjustment(actorUserId: string, payoutId: string, body: CreatePayoutAdjustmentInput) {
    return this.payouts.addAdjustment(actorUserId, payoutId, body);
  }

  markPaid(
    actorUserId: string,
    payoutId: string,
    body: { stripeTransferId: string; reason: string },
  ) {
    return this.payouts.markPaid(actorUserId, payoutId, body);
  }

  retryFailedTransfer(actorUserId: string, payoutId: string, reason: string) {
    return this.failedRetries.retry(actorUserId, payoutId, reason);
  }

  resolveBlockedPayout(actorUserId: string, payoutId: string, body: ResolveBlockedPayoutInput) {
    return this.blockedResolutions.resolve(actorUserId, payoutId, body);
  }

  adminManualReverse(actor: PayoutReversalActor, payoutId: string, input: { reason: string }) {
    return this.payouts.adminManualReverse(actor, payoutId, input);
  }

  resolveStatementPdf(payoutId: string) {
    return this.payoutStatement.resolveForAdmin(payoutId);
  }
}
