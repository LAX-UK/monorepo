import { describe, expect, it } from "vitest";
import {
  peopleListHrefFromRecord,
  peopleListQuery,
  peoplePanelRedirect,
  peopleRecordHref,
} from "./people-record-href";

describe("people record links", () => {
  it("keeps the list's own query, never the old panel or a nested list", () => {
    expect(peopleListQuery("/admin/clients", { status: "active", client: "u1", q: "ada" })).toBe(
      "status=active&q=ada",
    );
    expect(peopleListQuery("/admin/staff", { staff: "s1" })).toBe("");
  });

  it("puts the list on the person's page", () => {
    expect(peopleRecordHref("/admin/clients", "u 1", "q=ada")).toBe(
      "/admin/clients/u%201?list=q%3Dada",
    );
    expect(peopleRecordHref("/admin/staff", "s1", "")).toBe("/admin/staff/s1");
  });

  it("sends an old panel link to the person's page, keeping the list", () => {
    expect(
      peoplePanelRedirect("/admin/clients", { client: "u1", status: "suspended", offset: "50" }),
    ).toBe("/admin/clients/u1?list=status%3Dsuspended%26offset%3D50");
    expect(peoplePanelRedirect("/admin/staff", { staff: ["s1"] })).toBe("/admin/staff/s1");
    expect(peoplePanelRedirect("/admin/clients", { client: " " })).toBeNull();
    expect(peoplePanelRedirect("/admin/clients", { status: "active" })).toBeNull();
  });

  it("leads back to the list the page was opened from", () => {
    expect(peopleListHrefFromRecord("/admin/clients", { list: "status=active&q=ada" })).toBe(
      "/admin/clients?status=active&q=ada",
    );
    expect(peopleListHrefFromRecord("/admin/staff", { returnTo: "/admin/staff?q=bo" })).toBe(
      "/admin/staff?q=bo",
    );
    expect(
      peopleListHrefFromRecord("/admin/clients", { returnTo: "/admin/onboarding-issues?tab=kyc" }),
    ).toBe("/admin/onboarding-issues?tab=kyc");
    expect(peopleListHrefFromRecord("/admin/clients", { returnTo: "https://evil.example" })).toBe(
      "/admin/clients",
    );
    expect(peopleListHrefFromRecord("/admin/staff", {})).toBe("/admin/staff");
  });
});
