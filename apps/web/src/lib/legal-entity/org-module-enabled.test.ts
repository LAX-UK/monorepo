import { afterEach, describe, expect, it, vi } from "vitest";
import { isOrgModuleEnabled, isProductionWebHost, normalizeHostname } from "./org-module-enabled";

describe("normalizeHostname", () => {
  it("strips port and lowercases", () => {
    expect(normalizeHostname("LAX.BID:443")).toBe("lax.bid");
  });
});

describe("isProductionWebHost", () => {
  it("matches production hosts", () => {
    expect(isProductionWebHost("lax.bid")).toBe(true);
    expect(isProductionWebHost("www.lax.bid")).toBe(true);
  });

  it("does not match staging or local", () => {
    expect(isProductionWebHost("test.lax.bid")).toBe(false);
    expect(isProductionWebHost("localhost")).toBe(false);
  });
});

describe("isOrgModuleEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled on lax.bid", () => {
    expect(isOrgModuleEnabled("lax.bid")).toBe(false);
  });

  it("is enabled on test.lax.bid and localhost", () => {
    expect(isOrgModuleEnabled("test.lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("localhost:3000")).toBe(true);
  });

  it("respects NEXT_PUBLIC_FORCE_ORG_MODULE override", () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    expect(isOrgModuleEnabled("test.lax.bid")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "visible");
    expect(isOrgModuleEnabled("lax.bid")).toBe(true);
  });
});
