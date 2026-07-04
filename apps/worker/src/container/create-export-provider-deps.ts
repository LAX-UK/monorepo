import type { Database } from "@auction/db";
import {
  AnalyticsService,
  DefaultMetricsAggregator,
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportLegalEntityReader,
  DrizzleExportPaymentReader,
  DrizzleExportPayoutReader,
} from "@auction/exports/infrastructure";
import type { IExportProviderDeps } from "@auction/exports/providers";
import {
  DrizzleItemSubmissionRepository,
  DrizzleLotMetricsReader,
  DrizzleLotRepository,
  DrizzlePaymentMetricsReader,
  DrizzleSaleRepository,
  DrizzleUserMetricsReader,
} from "@auction/persistence/repositories";

export function createExportProviderDeps(db: Database): IExportProviderDeps {
  const lotMetrics = new DrizzleLotMetricsReader(db);
  const paymentMetrics = new DrizzlePaymentMetricsReader(db);
  const userMetrics = new DrizzleUserMetricsReader(db);
  const analytics = new AnalyticsService(
    lotMetrics,
    paymentMetrics,
    userMetrics,
    new DefaultMetricsAggregator(),
  );

  return {
    lotRepo: new DrizzleLotRepository(db),
    saleRepo: new DrizzleSaleRepository(db),
    submissionRepo: new DrizzleItemSubmissionRepository(db),
    adminUserReader: new DrizzleExportAdminUserReader(db),
    paymentRepo: new DrizzleExportPaymentReader(db),
    domainEvents: new DrizzleExportDomainEventsQuery(db),
    payoutRepo: new DrizzleExportPayoutReader(db),
    legalEntityRepo: new DrizzleExportLegalEntityReader(db),
    analytics,
  };
}
