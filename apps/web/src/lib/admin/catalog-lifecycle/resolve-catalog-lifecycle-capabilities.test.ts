import { describe, expect, it } from "vitest";
import { resolveCatalogLifecycleCapabilities } from "./resolve-catalog-lifecycle-capabilities";

describe("resolveCatalogLifecycleCapabilities", () => {
  it("grants sale lifecycle to staff with sales access", () => {
    const caps = resolveCatalogLifecycleCapabilities({
      role: "staff",
      staffRole: "auction_manager",
    });
    expect(caps.canMutateSalesLifecycle).toBe(true);
    expect(caps.canMutateLotLifecycle).toBe(true);
  });

  it("denies lifecycle mutations for clients", () => {
    const caps = resolveCatalogLifecycleCapabilities({
      role: "client",
      staffRole: null,
    });
    expect(caps.canMutateSalesLifecycle).toBe(false);
    expect(caps.canMutateLotMembership).toBe(false);
  });
});
