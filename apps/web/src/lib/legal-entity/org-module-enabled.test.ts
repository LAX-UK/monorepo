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

  it("is enabled on all hosts including lax.bid (launched)", () => {
    expect(isOrgModuleEnabled("lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("www.lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("test.lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("localhost:3000")).toBe(true);
  });

  it("respects NEXT_PUBLIC_FORCE_ORG_MODULE=hidden kill switch", () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    expect(isOrgModuleEnabled("test.lax.bid")).toBe(false);
    expect(isOrgModuleEnabled("lax.bid")).toBe(false);
  });
});
