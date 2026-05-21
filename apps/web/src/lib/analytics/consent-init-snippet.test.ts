import { describe, expect, it } from "vitest";
import { buildConsentInitSnippet } from "./consent-init-snippet";

describe("buildConsentInitSnippet", () => {
  it("sets consent default to denied when no snapshot", () => {
    const s = buildConsentInitSnippet(null);
    expect(s).toContain("gtag('consent','default'");
    expect(s).toContain('"analytics_storage":"denied"');
    expect(s).not.toContain("gtag('consent','update'");
  });

  it("adds consent update when snapshot has analytics", () => {
    const s = buildConsentInitSnippet({
      v: 1,
      ts: "2026-01-01T00:00:00.000Z",
      necessary: true,
      analytics: true,
      marketing: false,
    });
    expect(s).toContain("gtag('consent','update'");
    expect(s).toContain('"analytics_storage":"granted"');
    expect(s).toContain('"ad_storage":"denied"');
  });
});
