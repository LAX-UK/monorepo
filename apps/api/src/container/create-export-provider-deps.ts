import type { Database } from "@auction/db";
import {
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportLegalEntityReader,
  DrizzleExportPayoutReader,
} from "@auction/exports/infrastructure";
import type { IExportProviderDeps } from "@auction/exports/providers";
import { DrizzlePaymentRepository } from "@auction/persistence/repositories";
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
    // The staff Payments list's own query, so an export holds exactly the rows the list shows.
    paymentRepo: new DrizzlePaymentRepository(db),
    domainEvents: new DrizzleExportDomainEventsQuery(db),
    payoutRepo: new DrizzleExportPayoutReader(db),
    legalEntityRepo: new DrizzleExportLegalEntityReader(db),
  };
}
