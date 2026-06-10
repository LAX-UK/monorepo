import { afterEach, describe, expect, it, vi } from "vitest";
import { isOrgModuleEnabled } from "./org-module-enabled.js";

describe("isOrgModuleEnabled (api)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled for production WEB_ORIGIN (launched)", () => {
    expect(isOrgModuleEnabled("https://lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("https://www.lax.bid")).toBe(true);
  });

  it("is enabled for staging and local WEB_ORIGIN", () => {
    expect(isOrgModuleEnabled("https://test.lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("http://localhost:3000")).toBe(true);
  });

  it("respects FORCE_ORG_MODULE=hidden kill switch", () => {
    vi.stubEnv("FORCE_ORG_MODULE", "hidden");
    expect(isOrgModuleEnabled("https://test.lax.bid")).toBe(false);
    expect(isOrgModuleEnabled("https://lax.bid")).toBe(false);
  });
});
