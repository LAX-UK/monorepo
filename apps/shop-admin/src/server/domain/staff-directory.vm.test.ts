import { describe, expect, it } from "vitest";
import {
  type StaffMemberRow,
  filterStaff,
  lastActiveLabel,
  parseStaffListParams,
  staffListHref,
  staffMemberName,
  staffMemberStatus,
  staffTeamViews,
} from "./staff-directory.vm";

describe("the staff list URL", () => {
  it("writes the search and each role, and nothing when there is no filter", () => {
    expect(staffListHref({ q: "  ada ", roles: ["finance", "broker"] })).toBe(
      "/staff?q=ada&role=finance&role=broker",
    );
    expect(staffListHref({ q: "", roles: [] })).toBe("/staff");
  });

  it("reads it back, dropping roles that do not exist", () => {
    expect(
      parseStaffListParams(new URLSearchParams("q=ada&role=finance&role=wizard&role=broker")),
    ).toEqual({ q: "ada", roles: ["finance", "broker"] });
  });

  it("offers team views whose links read back as the same filter", () => {
    const views = staffTeamViews();
    expect(views.map((view) => view.label)).toEqual([
      "Administrators",
      "Sales team",
      "Operations and catalogue",
      "Finance",
    ]);
    for (const view of views) {
      const filter = parseStaffListParams(new URLSearchParams(view.query));
      expect(filter.roles.length).toBeGreaterThan(0);
      expect(staffListHref(filter)).toBe(view.href);
    }
  });
});

function row(overrides: Partial<StaffMemberRow>): StaffMemberRow {
  return {
    staffMemberId: "00000000-0000-4000-8000-000000000001",
    identitySubjectId: "subject-abcdefgh-123",
    displayName: "Ada Lovelace",
    email: "ada@lax.bid",
    lastActiveAt: null,
    role: "operations",
    disabledAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("staffMemberName", () => {
  it("prefers the name, then the email, then a short account reference", () => {
    expect(staffMemberName(row({}))).toBe("Ada Lovelace");
    expect(staffMemberName(row({ displayName: null }))).toBe("ada@lax.bid");
    expect(staffMemberName(row({ displayName: null, email: null }))).toBe("Account subject-");
  });
});

describe("staffMemberStatus", () => {
  it("reads disabled members as disabled", () => {
    expect(staffMemberStatus(row({})).label).toBe("Active");
    expect(staffMemberStatus(row({ disabledAt: "2026-02-01T00:00:00.000Z" })).label).toBe(
      "Disabled",
    );
  });
});

describe("lastActiveLabel", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  it.each([
    [null, "No activity yet"],
    ["2026-10-24T08:00:00.000Z", "Today"],
    ["2026-10-23T08:00:00.000Z", "Yesterday"],
    ["2026-10-20T12:00:00.000Z", "4 days ago"],
    ["2026-07-24T12:00:00.000Z", "3 months ago"],
    ["2024-10-24T12:00:00.000Z", "2 years ago"],
  ])("%s reads as %s", (iso, label) => {
    expect(lastActiveLabel(iso, now)).toBe(label);
  });
});

describe("filterStaff", () => {
  const rows = [
    row({ staffMemberId: "a", displayName: "Ada Lovelace", role: "operations" }),
    row({
      staffMemberId: "b",
      displayName: "Grace Hopper",
      email: "grace@lax.bid",
      role: "finance",
    }),
  ];
  it("searches name and email, case-insensitively", () => {
    expect(filterStaff(rows, { q: "GRACE", roles: [] }).map((r) => r.staffMemberId)).toEqual(["b"]);
  });
  it("narrows by role", () => {
    expect(filterStaff(rows, { q: "", roles: ["operations"] }).map((r) => r.staffMemberId)).toEqual(
      ["a"],
    );
  });
});
