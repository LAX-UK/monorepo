import { describe, expect, it } from "vitest";
import {
  type StaffMemberRow,
  filterStaff,
  lastActiveLabel,
  staffMemberName,
  staffMemberStatus,
} from "./staff-directory.vm";

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
