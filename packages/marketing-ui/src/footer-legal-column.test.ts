import { describe, expect, it } from "vitest";
import { buildFooterLegalColumn } from "./footer-legal-column.js";

describe("buildFooterLegalColumn", () => {
  it("lists the index, terms, privacy, cookies and cookie settings in that order", () => {
    const column = buildFooterLegalColumn({
      cookiePreferences: "#cookie-preferences",
      cookies: "/cookies",
      privacy: "/privacy",
      terms: "/terms",
      index: "/legal",
    });
    expect(column?.title).toBe("Legal");
    expect(column?.links.map((link) => link.label)).toEqual([
      "Legal and policies",
      "Terms",
      "Privacy",
      "Cookies",
      "Cookie settings",
    ]);
  });

  it("leaves out a page the product does not have", () => {
    const column = buildFooterLegalColumn({ terms: "/terms", privacy: "/privacy" });
    expect(column?.links).toEqual([
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ]);
  });

  it("returns no column when nothing can be linked", () => {
    expect(buildFooterLegalColumn({})).toBeNull();
  });
});
