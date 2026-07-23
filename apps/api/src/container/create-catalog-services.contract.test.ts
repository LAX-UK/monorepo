import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ContainerCatalogAdminReaders } from "./create-catalog-admin-readers.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerLotCatalogServices } from "./create-lot-catalog-services.js";
import type { ContainerOnsiteEventServices } from "./create-onsite-event-services.js";
import type { ContainerSaleRegistrationServices } from "./create-sale-registration-services.js";

type ContainerCatalogServicesComposed = ContainerLotCatalogServices &
  ContainerSaleRegistrationServices &
  ContainerOnsiteEventServices &
  ContainerCatalogAdminReaders;

type _CatalogServicesContract = ContainerCatalogServices extends ContainerCatalogServicesComposed
  ? ContainerCatalogServicesComposed extends ContainerCatalogServices
    ? true
    : never
  : never;

defineCompileTimeContract<_CatalogServicesContract>();

describe("create-catalog-services contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
