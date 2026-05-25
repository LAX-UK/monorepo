import { describe, expect, it } from "vitest";
import { isOrgModuleEnabled } from "./org-module-enabled.js";

describe("isOrgModuleEnabled (api)", () => {
  it("is disabled for production WEB_ORIGIN", () => {
    expect(isOrgModuleEnabled("https://lax.bid")).toBe(false);
    expect(isOrgModuleEnabled("https://www.lax.bid")).toBe(false);
  });

  it("is enabled for staging and local WEB_ORIGIN", () => {
    expect(isOrgModuleEnabled("https://test.lax.bid")).toBe(true);
    expect(isOrgModuleEnabled("http://localhost:3000")).toBe(true);
  });

  it("fails open on malformed origin", () => {
    expect(isOrgModuleEnabled("not-a-url")).toBe(true);
  });
});
