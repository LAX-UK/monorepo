import type { Database } from "@auction/db";
import { DrizzleAdminUserReader } from "../repositories/drizzle-admin-user.reader.js";
import { DrizzleItemSubmissionRepository } from "../repositories/drizzle-item-submission.repository.js";
import { DrizzleLegalEntityRepository } from "../repositories/drizzle-legal-entity.repository.js";
import { DrizzleLotMetricsReader } from "../repositories/drizzle-lot-metrics.reader.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
import { DrizzlePaymentMetricsReader } from "../repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRepository } from "../repositories/drizzle-payment.repository.js";
import { DrizzlePayoutRepository } from "../repositories/drizzle-payout.repository.js";
import { DrizzleSaleRepository } from "../repositories/drizzle-sale.repository.js";
import { DrizzleUserMetricsReader } from "../repositories/drizzle-user-metrics.reader.js";
import { AdminDomainEventQueryService } from "../services/admin/admin-domain-event-query.service.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { DefaultMetricsAggregator } from "../services/default-metrics.aggregator.js";
import type { ExportProviderDeps } from "./registry.js";

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
    adminUserReader: new DrizzleAdminUserReader(db),
    paymentRepo: new DrizzlePaymentRepository(db),
    domainEvents: new AdminDomainEventQueryService(db),
    payoutRepo: new DrizzlePayoutRepository(db),
    legalEntityRepo: new DrizzleLegalEntityRepository(db),
    analytics,
  };
}
