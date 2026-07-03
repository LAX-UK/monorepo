import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerCatalogServicesLegacy } from "./create-catalog-services.legacy.js";

type _CatalogServicesContract = ContainerCatalogServicesLegacy extends ContainerCatalogServices
  ? ContainerCatalogServices extends ContainerCatalogServicesLegacy
    ? true
    : never
  : never;

defineCompileTimeContract<_CatalogServicesContract>();

describe("create-catalog-services contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
