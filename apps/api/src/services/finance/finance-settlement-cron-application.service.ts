import type { SettlementCronService } from "../cron/settlement-cron.service.js";
import type { IFinanceSettlementCronApplicationService } from "../interfaces/finance-routes/finance-settlement-cron.js";

/** Idempotent sold-lot invoice ensure (event projector + reconciliation sweep). */
export class FinanceSettlementCronApplicationService
  implements IFinanceSettlementCronApplicationService
{
  constructor(private readonly settlementCronService: SettlementCronService) {}

  ensureLotInvoice(lotId: string) {
    return this.settlementCronService.ensureLotInvoice(lotId);
  }

  ensureLotInvoices() {
    return this.settlementCronService.ensureLotInvoices();
  }
}
