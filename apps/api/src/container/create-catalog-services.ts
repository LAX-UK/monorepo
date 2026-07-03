import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import type { ContainerCatalogAdminReaders } from "./create-catalog-admin-readers.js";
import { createCatalogAdminReaders } from "./create-catalog-admin-readers.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotCatalogServices } from "./create-lot-catalog-services.js";
import { createLotCatalogServices } from "./create-lot-catalog-services.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerOnsiteEventServices } from "./create-onsite-event-services.js";
import { createOnsiteEventServices } from "./create-onsite-event-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";
import type { ContainerSaleRegistrationServices } from "./create-sale-registration-services.js";
import { createSaleRegistrationServices } from "./create-sale-registration-services.js";

export type ContainerLotSaleServices = ContainerLotCatalogServices &
  ContainerSaleRegistrationServices;

export type ContainerCatalogServices = ContainerLotSaleServices &
  ContainerOnsiteEventServices &
  ContainerCatalogAdminReaders;

export type CreateCatalogServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  lotLifecycle: ContainerLotLifecycle;
  complianceMedia: ContainerComplianceMedia;
};

export function createCatalogServices(input: CreateCatalogServicesInput): ContainerCatalogServices {
  const { env, db, infra, repos, platform, lotLifecycle, complianceMedia } = input;

  const adminReaders = createCatalogAdminReaders({ env, db, infra, repos });
  const saleRegistration = createSaleRegistrationServices({
    env,
    db,
    infra,
    repos,
    platform,
    complianceMedia,
  });
  const lotCatalog = createLotCatalogServices({
    env,
    db,
    infra,
    repos,
    platform,
    lotLifecycle,
    complianceMedia,
    saleRegistration,
    adminReaders,
  });
  const onsiteEvents = createOnsiteEventServices({ env, db, repos, platform });

  return {
    ...lotCatalog,
    ...saleRegistration,
    ...onsiteEvents,
    ...adminReaders,
  };
}

/** @deprecated Prefer sub-slice types from create-*-services.ts for narrow deps. */
export type { ContainerCatalogServicesLegacy } from "./create-catalog-services.legacy.js";
