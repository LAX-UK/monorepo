import { describe, expect, it } from "vitest";
import { policyHubPageJsonLd } from "./structured-data";

describe("policyHubPageJsonLd", () => {
  it("returns escaped JSON-LD string with WebPage and BreadcrumbList", () => {
    const raw = policyHubPageJsonLd({
      path: "/privacy",
      breadcrumbName: "Privacy Notice",
      pageName: "Privacy notice",
      description: "Test description for structured data.",
    });
    expect(raw).toMatch(/BreadcrumbList/);
    expect(raw).toMatch(/WebPage/);
    expect(raw).toMatch(/Organization/);
    expect(raw).not.toContain("<");
  });
});
