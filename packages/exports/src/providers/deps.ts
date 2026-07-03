import type { Database } from "@auction/db";
import {
  DrizzleItemSubmissionRepository,
  DrizzleLotRepository,
  DrizzleSaleRepository,
} from "@auction/persistence";
import type { ExportProviderDeps } from "./create-export-providers.js";
import { AnalyticsService } from "./infrastructure/analytics.service.js";
import { DefaultMetricsAggregator } from "./infrastructure/default-metrics.aggregator.js";
import { DrizzleExportAdminUserReader } from "./infrastructure/drizzle-export-admin-user.reader.js";
import { DrizzleExportDomainEventsQuery } from "./infrastructure/drizzle-export-domain-events.query.js";
import { DrizzleExportLegalEntityReader } from "./infrastructure/drizzle-export-legal-entity.reader.js";
import { DrizzleExportPaymentReader } from "./infrastructure/drizzle-export-payment.reader.js";
import { DrizzleExportPayoutReader } from "./infrastructure/drizzle-export-payout.reader.js";
import { DrizzleLotMetricsReader } from "./infrastructure/drizzle-lot-metrics.reader.js";
import { DrizzlePaymentMetricsReader } from "./infrastructure/drizzle-payment-metrics.reader.js";
import { DrizzleUserMetricsReader } from "./infrastructure/drizzle-user-metrics.reader.js";

/** Build export provider dependencies for API or worker (shared list-query paths). */
export function createExportProviderDeps(db: Database): ExportProviderDeps {
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
