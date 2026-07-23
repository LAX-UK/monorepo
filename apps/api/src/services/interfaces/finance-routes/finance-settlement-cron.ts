import type { SettlementCronService } from "../../cron/settlement-cron.service.js";

export interface IFinanceSettlementCronApplicationService {
  ensureLotInvoice(lotId: string): ReturnType<SettlementCronService["ensureLotInvoice"]>;
  ensureLotInvoices(): ReturnType<SettlementCronService["ensureLotInvoices"]>;
}
