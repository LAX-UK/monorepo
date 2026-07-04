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
import type { ContainerRepositories } from "./create-repositories.js";

export type CreateExportProviderDepsInput = Pick<
  ContainerRepositories,
  | "lotRepo"
  | "saleRepo"
  | "itemSubmissionRepository"
  | "lotMetrics"
  | "paymentMetrics"
  | "userMetrics"
>;

export function createExportProviderDeps(
  db: Database,
  repos: CreateExportProviderDepsInput,
): IExportProviderDeps {
  const analytics = new AnalyticsService(
    repos.lotMetrics,
    repos.paymentMetrics,
    repos.userMetrics,
    new DefaultMetricsAggregator(),
  );

  return {
    lotRepo: repos.lotRepo,
    saleRepo: repos.saleRepo,
    submissionRepo: repos.itemSubmissionRepository,
    adminUserReader: new DrizzleExportAdminUserReader(db),
    paymentRepo: new DrizzleExportPaymentReader(db),
    domainEvents: new DrizzleExportDomainEventsQuery(db),
    payoutRepo: new DrizzleExportPayoutReader(db),
    legalEntityRepo: new DrizzleExportLegalEntityReader(db),
    analytics,
  };
}
