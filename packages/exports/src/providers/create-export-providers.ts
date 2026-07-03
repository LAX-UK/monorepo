import type {
  IItemSubmissionRepository,
  ILotRepository,
  ISaleRepository,
} from "@auction/persistence";
import type { ExportEntityType } from "../types.js";
import { createAnalyticsProvider } from "./analytics.provider.js";
import { createClientsProvider } from "./clients.provider.js";
import { createDomainEventsProvider } from "./domain-events.provider.js";
import { createLotsProvider } from "./lots.provider.js";
import { createPaymentsProvider } from "./payments.provider.js";
import { createPayoutsProvider } from "./payouts.provider.js";
import type { IAdminUserReader } from "./ports/admin-user.js";
import type { IAnalyticsService } from "./ports/analytics.js";
import type { IExportDomainEventsQuery } from "./ports/export-domain-events.query.js";
import type { ILegalEntityRepository } from "./ports/legal-entity-repository.js";
import type { IPaymentWriteRepository } from "./ports/payment-write.js";
import type { IPayoutRepository } from "./ports/payout-repository.js";
import { createSalesProvider } from "./sales.provider.js";
import { createSubmissionsProvider } from "./submissions.provider.js";
import type { ExportProvider } from "./types.js";

export type ExportProviderDeps = {
  lotRepo: ILotRepository;
  saleRepo: ISaleRepository;
  submissionRepo: IItemSubmissionRepository;
  adminUserReader: Pick<IAdminUserReader, "list">;
  paymentRepo: Pick<IPaymentWriteRepository, "listForExport" | "countForExport">;
  domainEvents: IExportDomainEventsQuery;
  payoutRepo: Pick<IPayoutRepository, "list" | "countMatching">;
  legalEntityRepo: Pick<ILegalEntityRepository, "findActiveMembership">;
  analytics: IAnalyticsService;
};

export function createExportProviders(
  deps: ExportProviderDeps,
): Map<ExportEntityType, ExportProvider> {
  return new Map([
    ["lots", createLotsProvider(deps.lotRepo) as ExportProvider],
    ["sales", createSalesProvider(deps.saleRepo) as ExportProvider],
    ["submissions", createSubmissionsProvider(deps.submissionRepo) as ExportProvider],
    ["clients", createClientsProvider(deps.adminUserReader) as ExportProvider],
    ["payments", createPaymentsProvider(deps.paymentRepo) as ExportProvider],
    ["domain-events", createDomainEventsProvider(deps.domainEvents) as ExportProvider],
    ["payouts", createPayoutsProvider(deps.payoutRepo, deps.legalEntityRepo) as ExportProvider],
    ["analytics", createAnalyticsProvider(deps.analytics) as ExportProvider],
  ]);
}
