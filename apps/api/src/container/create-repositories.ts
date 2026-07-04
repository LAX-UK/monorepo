import type { Database } from "@auction/db";
import { type AdminRepositories, createAdminRepositories } from "./create-admin-repos.js";
import { type CatalogRepositories, createCatalogRepositories } from "./create-catalog-repos.js";
import {
  type ComplianceRepositories,
  createComplianceRepositories,
} from "./create-compliance-repos.js";
import { type IdentityRepositories, createIdentityRepositories } from "./create-identity-repos.js";
import { type PaymentsRepositories, createPaymentsRepositories } from "./create-payments-repos.js";

export type { IArtistProfileRepository } from "./create-catalog-repos.js";
export type { IAmlScreeningRepository } from "./create-compliance-repos.js";
export type { IProfileRepository } from "./create-identity-repos.js";

/** Drizzle repositories and readers constructed from a single `Database` connection. */
export type ContainerRepositories = IdentityRepositories &
  CatalogRepositories &
  PaymentsRepositories &
  AdminRepositories &
  ComplianceRepositories;

export function createRepositories(db: Database): ContainerRepositories {
  return {
    ...createIdentityRepositories(db),
    ...createCatalogRepositories(db),
    ...createPaymentsRepositories(db),
    ...createAdminRepositories(db),
    ...createComplianceRepositories(db),
  };
}
