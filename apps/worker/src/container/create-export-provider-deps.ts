import type { Database } from "@auction/db";
import {
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportLegalEntityReader,
  DrizzleExportPayoutReader,
} from "@auction/exports/infrastructure";
import type { IExportProviderDeps } from "@auction/exports/providers";
import {
  DrizzleItemSubmissionRepository,
  DrizzleLotRepository,
  DrizzlePaymentRepository,
  DrizzleSaleRepository,
} from "@auction/persistence/repositories";

export function createExportProviderDeps(db: Database): IExportProviderDeps {
  return {
    lotRepo: new DrizzleLotRepository(db),
    saleRepo: new DrizzleSaleRepository(db),
    submissionRepo: new DrizzleItemSubmissionRepository(db),
    adminUserReader: new DrizzleExportAdminUserReader(db),
    // The staff Payments list's own query, so an export holds exactly the rows the list shows.
    paymentRepo: new DrizzlePaymentRepository(db),
    domainEvents: new DrizzleExportDomainEventsQuery(db),
    payoutRepo: new DrizzleExportPayoutReader(db),
    legalEntityRepo: new DrizzleExportLegalEntityReader(db),
  };
}
