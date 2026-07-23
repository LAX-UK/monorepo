import type { CreatePayoutAdjustmentInput } from "@auction/validators";
import type { IAdminPayoutApplicationService } from "../interfaces/admin-routes/admin-finance-routes.js";
import type { IPayoutStatementApplicationService } from "../interfaces/finance-routes/finance-payout-statement.js";
import type { IPayoutAdminService, IPayoutSettlementService } from "../interfaces/payout.js";
import type { AdminListPayoutsFilter } from "../interfaces/payout.js";
import type { AdminPayoutListPage } from "./admin-payout-list-query.service.js";

export class AdminPayoutApplicationService implements IAdminPayoutApplicationService {
  constructor(
    private readonly payouts: IPayoutAdminService,
    private readonly settlements: IPayoutSettlementService,
    private readonly payoutStatement: IPayoutStatementApplicationService,
  ) {}

  adminListPage(
    filter: AdminListPayoutsFilter & { limit: number; offset: number },
  ): Promise<AdminPayoutListPage> {
    return this.payouts.adminListPage(filter);
  }

  adminSettlementPreview(legalEntityId: string) {
    return this.payouts.adminSettlementPreview(legalEntityId);
  }

  createSettlement(
    actorUserId: string,
    input: { legalEntityId: string; periodStart: Date; periodEnd: Date },
  ) {
    return this.settlements.createSettlement(actorUserId, input);
  }

  addAdjustment(actorUserId: string, payoutId: string, body: CreatePayoutAdjustmentInput) {
    return this.payouts.addAdjustment(actorUserId, payoutId, body);
  }

  markPaid(actorUserId: string, payoutId: string, body: { stripeTransferId: string }) {
    return this.payouts.markPaid(actorUserId, payoutId, body);
  }

  adminManualReverse(actorUserId: string, payoutId: string, input: { reason: string }) {
    return this.payouts.adminManualReverse(actorUserId, payoutId, input);
  }

  resolveStatementPdf(payoutId: string) {
    return this.payoutStatement.resolveForAdmin(payoutId);
  }
}
