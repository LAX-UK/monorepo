import { describe, expect, it } from "vitest";
import { showsConsentBanner } from "./surfaces";

describe("showsConsentBanner", () => {
  it("hides the banner on every staff route", () => {
    expect(showsConsentBanner("/admin")).toBe(false);
    expect(showsConsentBanner("/admin/")).toBe(false);
    expect(showsConsentBanner("/admin/sales/abc/lots")).toBe(false);
  });

  it("shows it on consumer pages, including ones that only start with the same letters", () => {
    expect(showsConsentBanner("/")).toBe(true);
    expect(showsConsentBanner("/lots/abc")).toBe(true);
    expect(showsConsentBanner("/administration-fees")).toBe(true);
    expect(showsConsentBanner(null)).toBe(true);
  });
});
