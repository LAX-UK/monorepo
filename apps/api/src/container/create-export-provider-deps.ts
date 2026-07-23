import type { Database } from "@auction/db";
import {
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
  "lotRepo" | "saleRepo" | "itemSubmissionRepository"
>;

export function createExportProviderDeps(
  db: Database,
  repos: CreateExportProviderDepsInput,
): IExportProviderDeps {
  return {
    lotRepo: repos.lotRepo,
    saleRepo: repos.saleRepo,
    submissionRepo: repos.itemSubmissionRepository,
    adminUserReader: new DrizzleExportAdminUserReader(db),
    paymentRepo: new DrizzleExportPaymentReader(db),
    domainEvents: new DrizzleExportDomainEventsQuery(db),
    payoutRepo: new DrizzleExportPayoutReader(db),
    legalEntityRepo: new DrizzleExportLegalEntityReader(db),
  };
}
